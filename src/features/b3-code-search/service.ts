import { fetchHtmlViaProxy } from '../payment-schedule/fetchHtmlViaProxy';
import { isLocalhost } from '../../utils/scraper-client';
import {
  cleanedAssetName,
  cleanedIssuerName,
  detectProductCode,
  extractStrongTerms,
  extractMaturityMonthName,
  extractMaturityMonthYear,
} from './normalize';
import { b3SearchProviders } from './providers';
import { CONFIDENCE_THRESHOLDS, extractB3Candidates, scoreHit } from './scoring';
import type {
  AssetB3FinderInput,
  AssetB3MatchCandidate,
  AssetB3MatchResult,
  B3SearchProvider,
  SearchHit,
} from './types';

export interface FindB3CodeOptions {
  /**
   * Lista de provedores. Default: `b3SearchProviders`. Útil para testes
   * (provedores fake) e para limitar a fontes específicas.
   */
  providers?: B3SearchProvider[];
  /**
   * Limita o número de queries por provedor. Default 8 — cobre as
   * estratégias progressivas incluindo emissor puro, emissor+vencimento,
   * emissor+tipo, emissor+ano, emissor+indexador, nome+indexador, etc.
   */
  maxQueriesPerProvider?: number;
  /**
   * Quando true (default), o serviço busca o HTML completo das melhores
   * hits sem código no snippet e tenta extrair direto do corpo da página.
   * Cada página custa um round-trip extra pelo proxy — limite via
   * `deepHarvestLimit`.
   */
  deepHarvest?: boolean;
  /** Quantas páginas no máximo o deep harvest pode buscar. Default 4. */
  deepHarvestLimit?: number;
  /** Override para testes do fetcher de páginas (deep harvest). */
  fetchPage?: (url: string) => Promise<string>;
  /** Override de relógio para testes. */
  now?: () => Date;
  /** Recebe cada linha de log assim que ela é produzida. */
  onLog?: (line: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function timestamp(now: () => Date): string {
  const d = now();
  return `[${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}]`;
}

function formatMaturityDatePtBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Estratégias de busca progressivas, da mais restritiva à mais ampla.
 * Privilegia parâmetros objetivos (nome, tipo de ativo, vencimento,
 * indexador). A taxa não entra: depende da corretora/data e gera
 * falsos negativos quando o canal de distribuição precifica diferente.
 *
 * O service consome em ordem e apenas as `maxQueriesPerProvider`
 * primeiras estratégias são executadas por provedor.
 */
export function buildSearchQueries(input: AssetB3FinderInput): string[] {
  const name = cleanedAssetName(input);
  const issuer = cleanedIssuerName(input);
  const product = detectProductCode(input);
  const my = extractMaturityMonthYear(input.maturityDate);
  const myName = extractMaturityMonthName(input.maturityDate);
  const year = input.maturityDate?.match(/^(\d{4})/)?.[1] ?? null;
  const exactDate = formatMaturityDatePtBr(input.maturityDate);
  const indexer = (input.indexers || '').trim();
  const issuerDiffers = issuer && issuer !== name;
  const strongTerms = extractStrongTerms(input);

  const queries: string[] = [];
  const push = (q: string): void => {
    const compact = q.replace(/\s+/g, ' ').trim();
    if (compact && !queries.includes(compact)) queries.push(compact);
  };

  // 1) Emissor puro — query mais importante para buscadores diretos
  //    (securitizadoras, agentes fiduciários). Deve estar no topo.
  if (issuer) push(issuer);
  // 2) Emissor sem o prefixo do produto + mês/ano nominal — versão que
  //    casa com securitizadora/agente fiduciário ("REDE SIM FEV/2030").
  if (issuer && myName) push(`${issuer} ${myName}`);
  // 3) Apelido completo + mês/ano nominal (corretora/portal — "CRA REDE SIM JUL/2030").
  if (issuerDiffers && myName) push(`${name} ${myName}`);
  else if (!issuerDiffers && myName) push(`${name} ${myName}`);
  // 4) Variantes numéricas do vencimento.
  if (issuer && my) push(`${issuer} ${my}`);
  if (issuerDiffers && my) push(`${name} ${my}`);
  // 5) Emissor + tipo de ativo (busca por código IF em sites oficiais).
  if (issuer && product) push(`${issuer} ${product}`);
  // 6) Emissor + ano (menos restritivo, mas útil para desambiguar).
  if (issuer && year) push(`${issuer} ${year}`);
  // 7) Emissor + indexador (pega ativos do mesmo emissor com taxas diferentes).
  if (issuer && indexer) push(`${issuer} ${indexer}`);
  // 8) Nome (apelido completo) + indexador.
  if (issuerDiffers && indexer) push(`${name} ${indexer}`);
  // 9) Apelido completo isolado (caso o emissor coincida com o apelido).
  push(name);
  // 10) Tipo + vencimento + indexador, sem nome — útil quando a fonte
  //     pública usa o nome do emissor real em vez do apelido da corretora.
  if (product && myName && indexer) push(`${product} ${myName} ${indexer}`);
  else if (product && my && indexer) push(`${product} ${my} ${indexer}`);

  // 11) Emissor + "código IF" — busca específica para páginas que listam
  //     o código de identificação do instrumento financeiro.
  if (issuer && product) push(`${issuer} ${product} código IF`);
  // 12) Emissor + "CETIP" — nome antigo do sistema, ainda usado em muitas fontes.
  if (issuer) push(`${issuer} CETIP ${year || ''}`);
  if (strongTerms.length > 0 && product) push(`${product} ${strongTerms.join(' ')} codigo B3`);
  if (name && exactDate) push(`${name} vencimento ${exactDate}`);
  if (name && myName) push(`${name} ${myName.replace('/', ' ')}`);
  if (name) push(`${name} securitizadora`);
  if (name) push(`${name} termo de securitizacao`);
  if (name) push(`${name} documentos de emissao`);

  return queries;
}

/**
 * Remove tags HTML, scripts e styles para que o regex de códigos B3
 * opere sobre texto visível. Limita o tamanho para manter o regex
 * com tempo bounded em páginas grandes.
 */
export function stripHtmlText(html: string, limit = 100_000): string {
  const cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > limit ? cleaned.slice(0, limit) : cleaned;
}

interface RunOpts {
  pushLog: (msg: string) => void;
  productHint: ReturnType<typeof detectProductCode>;
  /** Hits sem código no snippet, para deep harvest posterior. */
  harvestPool: HarvestEntry[];
}

interface HarvestEntry {
  hit: SearchHit;
  baseScore: number;
  provider: string;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeDirectCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = decodeURIComponent(value).trim().toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(cleaned) ? cleaned : null;
}

function extractCodeFromFiduciaryUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host.includes('opea')) {
    return normalizeDirectCode(path.match(/\/emissoes\/([^/?#]+)/i)?.[1]);
  }
  if (host.includes('ecoagro')) {
    return normalizeDirectCode(path.match(/\/historico-pu\/\d+\/([^/?#]+)/i)?.[1]);
  }
  if (host.includes('vortx')) {
    return normalizeDirectCode(url.searchParams.get('busca'));
  }
  if (host.includes('pentagonotrustee')) {
    return normalizeDirectCode(url.searchParams.get('ativo'));
  }
  if (host.includes('oliveiratrust')) {
    return normalizeDirectCode(url.searchParams.get('busca'));
  }

  return null;
}

function collectFiduciaryUrlCandidates(input: AssetB3FinderInput): AssetB3MatchCandidate[] {
  const productHint = detectProductCode(input);
  const candidates = new Map<string, AssetB3MatchCandidate>();

  for (const url of input.fiduciaryAgentUrls || []) {
    const textCodes = productHint
      ? extractB3Candidates(url, productHint)
      : extractB3Candidates(url);
    const codes = unique([extractCodeFromFiduciaryUrl(url), ...textCodes]);

    for (const code of codes) {
      candidates.set(code, {
        b3Code: code,
        confidence: 90,
        sourceUrl: url,
        comparedData: {
          provider: 'fiduciary-agent-url',
          source: 'direct-url',
        },
      });
    }
  }

  return Array.from(candidates.values());
}

function hasRequiredFoundSignals(
  input: AssetB3FinderInput,
  candidate: AssetB3MatchCandidate,
): boolean {
  if (candidate.comparedData.source === 'direct-url') return true;

  const product = detectProductCode(input);
  if (product && candidate.comparedData.product !== 1) return false;
  // Regra obrigatória: com vencimento informado, só aceitamos FOUND quando
  // o mês/ano exato foi confirmado. Match fraco por ano (0.5) não passa.
  if (input.maturityDate && candidate.comparedData.maturity !== 1) return false;
  if (input.indexers && candidate.comparedData.indexer !== 1) return false;

  return true;
}

function bestFoundEligibleConfidence(
  input: AssetB3FinderInput,
  candidates: Iterable<AssetB3MatchCandidate>,
): number {
  let best = 0;
  for (const candidate of candidates) {
    if (!hasRequiredFoundSignals(input, candidate)) continue;
    if (candidate.confidence > best) best = candidate.confidence;
  }
  return best;
}

function applyHit(
  input: AssetB3FinderInput,
  hit: SearchHit,
  providerName: string,
  candidatesByCode: Map<string, AssetB3MatchCandidate>,
  source: 'snippet' | 'deep-harvest',
  enrichedHaystack: string | null,
): { score: number; codes: string[]; rejectedReason?: string } {
  const productHint = detectProductCode(input);
  const haystack = enrichedHaystack
    ? `${hit.title} ${hit.snippet} ${hit.url} ${enrichedHaystack}`
    : `${hit.title} ${hit.snippet} ${hit.url}`;

  const providerCandidates = productHint
    ? extractB3Candidates(hit.candidates.join(' '), productHint)
    : hit.candidates;
  const codes = productHint
    ? unique([...providerCandidates, ...extractB3Candidates(haystack, productHint)])
    : unique([...providerCandidates, ...extractB3Candidates(haystack)]);

  if (codes.length === 0) return { score: 0, codes: [] };

  // Quando temos o corpo da página, usamos um SearchHit "enriquecido"
  // para o scoring — assim termos do snippet ausente (vencimento,
  // indexador) ainda contam.
  const hitForScoring: SearchHit = enrichedHaystack
    ? { ...hit, snippet: `${hit.snippet}\n${enrichedHaystack}` }
    : hit;
  const score = scoreHit(input, hitForScoring);
  if (score.parts.maturityMismatch === 1) {
    return { score: score.total, codes, rejectedReason: 'vencimento divergente' };
  }
  if (score.parts.productMismatch === 1) {
    return { score: score.total, codes, rejectedReason: 'produto divergente' };
  }
  if (score.parts.indexerMismatch === 1) {
    return { score: score.total, codes, rejectedReason: 'indexador divergente' };
  }

  for (const code of codes) {
    const prev = candidatesByCode.get(code);
    if (!prev || prev.confidence < score.total) {
      candidatesByCode.set(code, {
        b3Code: code,
        confidence: score.total,
        sourceUrl: hit.url,
        comparedData: {
          ...score.parts,
          title: hit.title,
          snippet: hit.snippet,
          provider: providerName,
          source,
          reasons: score.reasons,
          rejections: score.rejections,
        },
      });
    }
  }
  return { score: score.total, codes };
}

function rankHits(
  input: AssetB3FinderInput,
  hits: SearchHit[],
  providerName: string,
  candidatesByCode: Map<string, AssetB3MatchCandidate>,
  { pushLog, harvestPool }: RunOpts,
): void {
  for (const hit of hits) {
    const { score, codes, rejectedReason } = applyHit(
      input,
      hit,
      providerName,
      candidatesByCode,
      'snippet',
      null,
    );

    if (rejectedReason) {
      pushLog(
        `[${providerName}] descartado (${rejectedReason}, score ${score.toFixed(0)}): ${codes.join(',')} ${hit.url}`,
      );
      continue;
    }

    if (codes.length === 0) {
      // Score "base" só com o que conseguimos do snippet — útil para
      // priorizar quais páginas vale a pena buscar inteiras depois.
      const base = scoreHit(input, hit);
      if (base.total >= CONFIDENCE_THRESHOLDS.lowConfidence - 10) {
        harvestPool.push({ hit, baseScore: base.total, provider: providerName });
        pushLog(
          `[${providerName}] sem código no snippet (score base ${base.total.toFixed(3)}, candidato a deep harvest): ${hit.url}`,
        );
      } else {
        pushLog(`[${providerName}] descartado (sem código e baixa relevância): ${hit.url}`);
      }
      continue;
    }

    pushLog(
      `[${providerName}] score ${score.toFixed(3)} → ${codes.join(',')} ${hit.url}`,
    );
  }
}

/** URLs from search engines or aggregators that won't contain B3 codes */
const SEARCH_ENGINE_HOSTS = [
  'google.com', 'google.com.br', 'bing.com', 'duckduckgo.com',
  'yahoo.com', 'baidu.com', 'yandex.com', 'brave.com',
  'search.brave.com', 'html.duckduckgo.com',
];

function isSearchEngineUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SEARCH_ENGINE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function runDeepHarvest(
  input: AssetB3FinderInput,
  harvestPool: HarvestEntry[],
  candidatesByCode: Map<string, AssetB3MatchCandidate>,
  fetchPage: (url: string) => Promise<string>,
  pushLog: (msg: string) => void,
  limit: number,
): Promise<void> {
  // Deduplica por URL — mesma página costuma aparecer em várias queries.
  const byUrl = new Map<string, HarvestEntry>();
  for (const entry of harvestPool) {
    // Skip search engine result pages and obviously irrelevant URLs
    if (isSearchEngineUrl(entry.hit.url)) {
      pushLog(`[harvest] ignorando URL de buscador: ${entry.hit.url}`);
      continue;
    }
    const prev = byUrl.get(entry.hit.url);
    if (!prev || prev.baseScore < entry.baseScore) byUrl.set(entry.hit.url, entry);
  }
  const sorted = Array.from(byUrl.values()).sort((a, b) => b.baseScore - a.baseScore).slice(0, limit);
  if (sorted.length === 0) {
    pushLog('[harvest] nenhum hit qualificado para busca profunda.');
    return;
  }
  pushLog(`[harvest] iniciando busca profunda em ${sorted.length} página(s).`);

  for (const entry of sorted) {
    pushLog(`[harvest] buscando HTML de ${entry.hit.url}`);
    let html: string;
    try {
      html = await fetchPage(entry.hit.url);
    } catch (err) {
      pushLog(`[harvest] erro: ${err instanceof Error ? err.message : 'desconhecido'}`);
      continue;
    }
    const text = stripHtmlText(html);
    const { score, codes, rejectedReason } = applyHit(
      input,
      entry.hit,
      entry.provider,
      candidatesByCode,
      'deep-harvest',
      text,
    );
    if (rejectedReason) {
      pushLog(
        `[harvest] descartado (${rejectedReason}, score ${score.toFixed(3)}): ${codes.join(',')} ${entry.hit.url}`,
      );
      continue;
    }
    if (codes.length === 0) {
      pushLog(`[harvest] sem código encontrado no corpo de ${entry.hit.url} (HTML ${html.length}b)`);
      continue;
    }
    pushLog(
      `[harvest] score ${score.toFixed(3)} (com corpo) → ${codes.join(',')} ${entry.hit.url}`,
    );
  }
}

/**
 * Tenta identificar o Código B3 de um ativo a partir dos campos do JSON.
 * Roda em localhost (depende do proxy `scripts/proxy-scraper.mjs`); em
 * produção retorna `NOT_FOUND` com log explicativo.
 *
 * Nunca chama persistência — devolve apenas o resultado para que a UI
 * apresente ao usuário e exija confirmação antes de gravar.
 */
export async function findB3Code(
  input: AssetB3FinderInput,
  options: FindB3CodeOptions = {},
): Promise<AssetB3MatchResult> {
  const now = options.now ?? ((): Date => new Date());
  const logs: string[] = [];
  const pushLog = (msg: string): void => {
    const line = `${timestamp(now)} ${msg}`;
    logs.push(line);
    options.onLog?.(line);
  };

  if (!isLocalhost()) {
    pushLog('Funcionalidade disponível apenas em localhost.');
    return { success: false, status: 'NOT_FOUND', logs };
  }

  const providers = options.providers ?? b3SearchProviders;
  const allQueries = buildSearchQueries(input);
  const queries = allQueries.slice(0, options.maxQueriesPerProvider ?? 8);
  const productHint = detectProductCode(input);
  const deepHarvest = options.deepHarvest !== false; // default true
  const deepHarvestLimit = options.deepHarvestLimit ?? 4;
  const fetchPage = options.fetchPage ?? fetchHtmlViaProxy;

  pushLog(
    `Iniciando busca: ${queries.length} estratégia(s) × ${providers.length} fonte(s)${productHint ? ` (produto=${productHint})` : ''}.`,
  );
  for (const q of queries) pushLog(`query gerada: "${q}"`);

  const candidatesByCode = new Map<string, AssetB3MatchCandidate>();
  const harvestPool: HarvestEntry[] = [];

  for (const candidate of collectFiduciaryUrlCandidates(input)) {
    candidatesByCode.set(candidate.b3Code, candidate);
    pushLog(
      `[agent-url] candidato direto ${candidate.b3Code} extraído de ${candidate.sourceUrl}`,
    );
  }

  const directCandidate = Array.from(candidatesByCode.values()).find(
    candidate => candidate.confidence >= CONFIDENCE_THRESHOLDS.found,
  );
  if (directCandidate) {
    pushLog(
      `Confiança suficiente via URL de agente (${directCandidate.confidence.toFixed(3)}) — encerrando busca antes dos buscadores.`,
    );
    return {
      success: true,
      status: 'FOUND',
      b3Code: directCandidate.b3Code,
      confidence: directCandidate.confidence,
      sourceUrl: directCandidate.sourceUrl,
      comparedData: directCandidate.comparedData,
      alternatives: Array.from(candidatesByCode.values())
        .filter(candidate => candidate.b3Code !== directCandidate.b3Code)
        .slice(0, 3),
      logs,
    };
  }

  let providersAttempted = 0;
  let providersErrored = 0;

  // ─── Fase 1: Providers com searchAll (discovery dedicado) ──────────────
  // Providers que implementam `searchAll` geram suas próprias queries
  // otimizadas para a fonte específica. Rodam ANTES do loop genérico.
  const searchAllProviders = providers.filter(p => p.searchAll);
  const genericProviders = providers.filter(p => !p.searchAll);

  if (searchAllProviders.length > 0) {
    pushLog(`--- Fase 1: ${searchAllProviders.length} provider(s) com discovery dedicado ---`);

    const searchAllResults = await Promise.allSettled(
      searchAllProviders.map(async (provider) => {
        pushLog(`[${provider.name}] executando searchAll (queries próprias)`);
        const hits = await provider.searchAll!(input);
        return { provider, hits };
      }),
    );

    for (const result of searchAllResults) {
      providersAttempted++;
      if (result.status === 'rejected') {
        providersErrored++;
        const reason = result.reason instanceof Error ? result.reason.message : 'desconhecido';
        pushLog(`[searchAll] erro: ${reason}`);
        continue;
      }
      const { provider, hits } = result.value;
      pushLog(`[${provider.name}] searchAll retornou ${hits.length} resultado(s).`);
      rankHits(input, hits, provider.name, candidatesByCode, {
        pushLog,
        productHint,
        harvestPool,
      });
    }

    const bestAfterSearchAll = bestFoundEligibleConfidence(input, candidatesByCode.values());
    if (bestAfterSearchAll >= CONFIDENCE_THRESHOLDS.found) {
      pushLog(`Confiança suficiente após searchAll (${bestAfterSearchAll.toFixed(3)}) — encerrando busca.`);
    }
  }

  // ─── Fase 2: Loop genérico de queries ──────────────────────────────────
  // Para cada query, todos os providers genéricos (sem searchAll) rodam
  // em PARALELO via Promise.allSettled. Providers com searchAll também
  // participam via `search()` para queries que façam sentido.
  // Após cada query, se já temos um candidato com confiança ≥ FOUND,
  // encerramos para não pagar round-trips desnecessários ao proxy.
  const bestAfterPhase1 = bestFoundEligibleConfidence(input, candidatesByCode.values());
  if (bestAfterPhase1 < CONFIDENCE_THRESHOLDS.found) {
    for (const query of queries) {
      pushLog(`--- query: "${query}" (${genericProviders.length} provider(s) em paralelo) ---`);

      const results = await Promise.allSettled(
        genericProviders.map(async (provider) => {
          pushLog(`[${provider.name}] consultando: "${query}"`);
          const hits = await provider.search(query);
          return { provider, hits };
        }),
      );

      for (const result of results) {
        providersAttempted++;
        if (result.status === 'rejected') {
          providersErrored++;
          const reason = result.reason instanceof Error ? result.reason.message : 'desconhecido';
          pushLog(`[provider] erro: ${reason}`);
          continue;
        }
        const { provider, hits } = result.value;
        pushLog(`[${provider.name}] ${hits.length} resultado(s) brutos.`);
        rankHits(input, hits, provider.name, candidatesByCode, {
          pushLog,
          productHint,
          harvestPool,
        });
      }

      const bestSoFar = bestFoundEligibleConfidence(input, candidatesByCode.values());
      if (bestSoFar >= CONFIDENCE_THRESHOLDS.found) {
        pushLog(`Confiança suficiente atingida (${bestSoFar.toFixed(3)}) — encerrando busca antecipada.`);
        break;
      }
    }
  }

  // Deep harvest só roda se ainda não temos um match FOUND e há hits
  // promissores sem código visível no snippet.
  const bestBeforeHarvest = bestFoundEligibleConfidence(input, candidatesByCode.values());
  if (deepHarvest && bestBeforeHarvest < CONFIDENCE_THRESHOLDS.found && harvestPool.length > 0) {
    try {
      await runDeepHarvest(input, harvestPool, candidatesByCode, fetchPage, pushLog, deepHarvestLimit);
    } catch (err) {
      pushLog(`[harvest] falhou: ${err instanceof Error ? err.message : 'desconhecido'}`);
    }
  }

  // Diagnóstico: todos os providers falharam? Provavelmente o proxy
  // local está fora do ar — dê uma orientação clara antes de devolver.
  if (providersAttempted > 0 && providersErrored === providersAttempted) {
    pushLog(
      'TODOS os providers falharam. Provável causa: proxy local off. Inicie em outro terminal: node scripts/proxy-scraper.mjs',
    );
  }

  if (candidatesByCode.size === 0) {
    pushLog('Nenhum candidato encontrado.');
    return { success: false, status: 'NOT_FOUND', logs };
  }

  const ranked = Array.from(candidatesByCode.values()).sort((a, b) => b.confidence - a.confidence);
  const bestFoundEligible = ranked.find(
    candidate =>
      candidate.confidence >= CONFIDENCE_THRESHOLDS.found &&
      hasRequiredFoundSignals(input, candidate),
  );
  if (bestFoundEligible) {
    pushLog(
      `Melhor candidato consistente: ${bestFoundEligible.b3Code} (confiança ${bestFoundEligible.confidence.toFixed(3)}).`,
    );
    return {
      success: true,
      status: 'FOUND',
      b3Code: bestFoundEligible.b3Code,
      confidence: bestFoundEligible.confidence,
      sourceUrl: bestFoundEligible.sourceUrl,
      comparedData: bestFoundEligible.comparedData,
      alternatives: ranked.filter(candidate => candidate.b3Code !== bestFoundEligible.b3Code).slice(0, 4),
      logs,
    };
  }

  const best = ranked[0];
  pushLog(
    `Melhor candidato: ${best.b3Code} (confiança ${best.confidence.toFixed(3)}). Limiares: FOUND≥${CONFIDENCE_THRESHOLDS.found}, LOW_CONFIDENCE≥${CONFIDENCE_THRESHOLDS.lowConfidence}.`,
  );

  if (best.confidence >= CONFIDENCE_THRESHOLDS.found) {
    pushLog(
      'Candidato com score alto rebaixado: faltou confirmar produto, vencimento ou indexador exigido pelo ativo.',
    );
  }

  if (best.confidence >= CONFIDENCE_THRESHOLDS.lowConfidence) {
    pushLog('Confiança abaixo do limiar de FOUND — usuário deve validar manualmente antes de gravar.');
    return {
      success: false,
      status: 'LOW_CONFIDENCE',
      b3Code: best.b3Code,
      confidence: best.confidence,
      sourceUrl: best.sourceUrl,
      comparedData: best.comparedData,
      alternatives: ranked.slice(1, 4),
      logs,
    };
  }

  pushLog('Nenhum candidato atingiu o limiar mínimo de confiança.');
  return {
    success: false,
    status: 'NOT_FOUND',
    alternatives: ranked.slice(0, 3),
    logs,
  };
}
