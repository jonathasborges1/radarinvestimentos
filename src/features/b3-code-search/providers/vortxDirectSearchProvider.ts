import type { AssetB3FinderInput, B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';
import { cleanedIssuerName, cleanedAssetName, detectProductCode } from '../normalize';

const VORTX_DCM_URL = 'https://www.vortx.com.br/investidor/dcm';
const MAX_DETAIL_PAGES = 5;

// â”€â”€â”€ Query Building (VÃ³rtx-specific) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Gera queries otimizadas para o buscador da VÃ³rtx.
 * A busca da VÃ³rtx funciona melhor com termos curtos e diretos (nome do emissor).
 * Queries com datas, indexadores ou termos longos tendem a nÃ£o retornar resultados.
 *
 * EstratÃ©gia: mÃºltiplas variaÃ§Ãµes do nome do emissor, da mais curta Ã  mais longa.
 */
export function buildVortxQueries(input: AssetB3FinderInput): string[] {
  const name = cleanedAssetName(input);       // "CRA FS BIO"
  const issuer = cleanedIssuerName(input);    // "FS BIO"
  const product = detectProductCode(input);   // "CRA"
  const year = input.maturityDate?.match(/^(\d{4})/)?.[1] ?? null;

  const queries: string[] = [];
  const push = (q: string): void => {
    const compact = q.replace(/\s+/g, ' ').trim();
    if (compact && compact.length >= 2 && !queries.includes(compact)) queries.push(compact);
  };

  // 1) Emissor puro â€” mais provÃ¡vel de funcionar na busca VÃ³rtx
  //    Ex: "FS BIO"
  push(issuer);

  // 2) Nome completo com produto â€” caso a VÃ³rtx indexe assim
  //    Ex: "CRA FS BIO"
  if (name !== issuer) push(name);

  // 3) Emissor + ano â€” para desambiguar quando hÃ¡ mÃºltiplas sÃ©ries
  //    Ex: "FS BIO 2030"
  if (year) push(`${issuer} ${year}`);

  // 4) Emissor + produto â€” variaÃ§Ã£o
  //    Ex: "FS BIO CRA"
  if (product) push(`${issuer} ${product}`);

  // 5) Partes individuais do emissor (para nomes compostos longos)
  //    Ex: se emissor Ã© "REDE D'OR SIM", tenta "REDE D'OR", "D'OR SIM"
  const parts = issuer.split(/\s+/).filter(p => p.length >= 2);
  if (parts.length > 2) {
    for (let i = 0; i < parts.length - 1; i++) {
      push(`${parts[i]} ${parts[i + 1]}`);
    }
  }

  // 6) Nome completo + ano
  if (year && name !== issuer) push(`${name} ${year}`);

  return queries;
}

export function buildVortxDcmSearchUrl(query: string): string {
  return `${VORTX_DCM_URL}?busca=${encodeURIComponent(query)}`;
}

// â”€â”€â”€ HTML Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteVortxUrl(href: string): string {
  return new URL(href, 'https://www.vortx.com.br').toString();
}

// â”€â”€â”€ Discovery: extrair links de operaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DiscoveryResult {
  operationLinks: string[];
  codes: string[];
  htmlSize: number;
  method: 'dom-links' | 'json-embedded' | 'regex-fallback' | 'none';
  rawText: string;
}

/**
 * Extrai links de operaÃ§Ã£o do HTML da pÃ¡gina de busca da VÃ³rtx.
 * Tenta mÃºltiplas estratÃ©gias:
 * 1. DOM parsing (links <a> com href contendo /operacao?id=)
 * 2. JSON embutido (__NEXT_DATA__, script[type="application/json"], etc.)
 * 3. Regex fallback para URLs no corpo do HTML bruto
 */
function discoverOperationLinks(html: string): DiscoveryResult {
  const result: DiscoveryResult = {
    operationLinks: [],
    codes: [],
    htmlSize: html.length,
    method: 'none',
    rawText: '',
  };

  if (!html || html.length < 50) return result;

  const text = stripHtml(html);
  result.rawText = text;
  result.codes = extractB3Candidates(text);

  // Strategy 1: DOM parsing â€” standard <a> links
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = Array.from(
      doc.querySelectorAll<HTMLAnchorElement>('a[href*="/investidor/dcm/operacao"]'),
    )
      .map((link) => link.getAttribute('href') || '')
      .filter(Boolean)
      .map(absoluteVortxUrl);

    if (links.length > 0) {
      result.operationLinks = [...new Set(links)];
      result.method = 'dom-links';
      return result;
    }
  } catch {
    // DOM parsing failed, continue to next strategy
  }

  // Strategy 2: JSON embutido â€” sites Next.js/React colocam dados em scripts
  const jsonPatterns = [
    // Next.js __NEXT_DATA__
    /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
    // Generic JSON script tags
    /<script\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i,
    // Nuxt.js
    /<script>window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i,
  ];

  for (const pattern of jsonPatterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      try {
        const jsonText = match[1];
        // Extract operation IDs from JSON
        const idMatches = [...jsonText.matchAll(/["'](?:id|operacaoId|operationId)["']\s*:\s*(\d+)/gi)];
        for (const idMatch of idMatches) {
          const url = `https://www.vortx.com.br/investidor/dcm/operacao?id=${idMatch[1]}`;
          if (!result.operationLinks.includes(url)) {
            result.operationLinks.push(url);
          }
        }

        // Also try to find operation URLs directly in JSON
        const urlMatches = [...jsonText.matchAll(/\/investidor\/dcm\/operacao\?id=(\d+)/g)];
        for (const urlMatch of urlMatches) {
          const url = `https://www.vortx.com.br/investidor/dcm/operacao?id=${urlMatch[1]}`;
          if (!result.operationLinks.includes(url)) {
            result.operationLinks.push(url);
          }
        }

        // Extract B3 codes from JSON content
        const jsonCodes = extractB3Candidates(jsonText);
        result.codes = [...new Set([...result.codes, ...jsonCodes])];

        if (result.operationLinks.length > 0) {
          result.method = 'json-embedded';
          return result;
        }
      } catch {
        // JSON parse failed, continue
      }
    }
  }

  // Strategy 3: Regex fallback â€” busca URLs de operaÃ§Ã£o em qualquer lugar do HTML bruto
  const urlRegex = /\/investidor\/dcm\/operacao\?id=(\d+)/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(html)) !== null) {
    const url = `https://www.vortx.com.br/investidor/dcm/operacao?id=${urlMatch[1]}`;
    if (!result.operationLinks.includes(url)) {
      result.operationLinks.push(url);
    }
  }

  // Also try encoded URLs
  const encodedUrlRegex = /investidor%2Fdcm%2Foperacao%3Fid%3D(\d+)/gi;
  while ((urlMatch = encodedUrlRegex.exec(html)) !== null) {
    const url = `https://www.vortx.com.br/investidor/dcm/operacao?id=${urlMatch[1]}`;
    if (!result.operationLinks.includes(url)) {
      result.operationLinks.push(url);
    }
  }

  // Try to find numeric IDs near "operacao" or "operaÃ§Ã£o" keywords
  const nearOperationRegex = /opera[cÃ§][aÃ£]o[^0-9]{0,30}(\d{4,6})/gi;
  while ((urlMatch = nearOperationRegex.exec(html)) !== null) {
    const url = `https://www.vortx.com.br/investidor/dcm/operacao?id=${urlMatch[1]}`;
    if (!result.operationLinks.includes(url)) {
      result.operationLinks.push(url);
    }
  }

  if (result.operationLinks.length > 0) {
    result.method = 'regex-fallback';
  }

  return result;
}

// â”€â”€â”€ Detail Page Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchDetailPage(url: string): Promise<{
  url: string;
  codes: string[];
  text: string;
  htmlSize: number;
  success: boolean;
  error?: string;
}> {
  try {
    const html = await fetchHtmlViaProxy(url);
    const text = stripHtml(html);
    const codes = extractB3Candidates(text);

    return {
      url,
      codes,
      text: text.slice(0, 8000),
      htmlSize: html.length,
      success: true,
    };
  } catch (err) {
    return {
      url,
      codes: [],
      text: '',
      htmlSize: 0,
      success: false,
      error: err instanceof Error ? err.message : 'desconhecido',
    };
  }
}

// â”€â”€â”€ Public Parsing (exported for tests) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function parseVortxDcmSearchHtml(html: string, searchUrl: string): SearchHit[] {
  const discovery = discoverOperationLinks(html);

  if (discovery.codes.length === 0 && discovery.operationLinks.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const code of discovery.codes) {
    hits.push({
      title: `VÃ³rtx DCM - ${code}`,
      snippet: discovery.rawText.slice(0, 4000),
      url: discovery.operationLinks[0] || searchUrl,
      candidates: [code],
    });
  }

  // Se nÃ£o encontrou cÃ³digos mas encontrou links, cria hit sem candidatos
  // para que enrichWithDetailPages busque o detalhe
  if (hits.length === 0 && discovery.operationLinks.length > 0) {
    for (const opUrl of discovery.operationLinks.slice(0, MAX_DETAIL_PAGES)) {
      hits.push({
        title: 'VÃ³rtx DCM - operaÃ§Ã£o candidata',
        snippet: discovery.rawText.slice(0, 4000),
        url: opUrl,
        candidates: [],
      });
    }
  }

  return hits;
}

async function enrichWithDetailPages(hits: SearchHit[]): Promise<SearchHit[]> {
  const detailUrls = Array.from(
    new Set(
      hits
        .map((hit) => hit.url)
        .filter((url) => /\/investidor\/dcm\/operacao\?id=/i.test(url)),
    ),
  ).slice(0, MAX_DETAIL_PAGES);

  if (detailUrls.length === 0) return hits;

  const details = await Promise.allSettled(
    detailUrls.map(async (url) => {
      const result = await fetchDetailPage(url);
      if (!result.success) return null;
      return {
        title: `VÃ³rtx DCM detalhe`,
        snippet: result.text,
        url,
        candidates: result.codes,
      } satisfies SearchHit;
    }),
  );

  const detailHits = details
    .filter((result): result is PromiseFulfilledResult<SearchHit | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((hit): hit is SearchHit => hit !== null);

  return [...detailHits, ...hits];
}

// â”€â”€â”€ Provider Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Provider VÃ³rtx com discovery dedicado e queries prÃ³prias.
 *
 * Diferente dos providers genÃ©ricos (DDG, Google), este provider:
 * 1. Gera suas prÃ³prias queries otimizadas para o buscador da VÃ³rtx
 *    (curtas, sem datas/indexadores que a busca VÃ³rtx nÃ£o entende)
 * 2. Tenta mÃºltiplas estratÃ©gias de extraÃ§Ã£o de links (DOM, JSON, regex)
 * 3. Segue links de operaÃ§Ã£o candidatos para extrair o cÃ³digo B3
 *
 * Implementa `searchAll` para rodar todas as queries VÃ³rtx-especÃ­ficas
 * de uma vez, independente do loop genÃ©rico do service.
 */
export const vortxDirectSearchProvider: B3SearchProvider = {
  name: 'vortx-direto',

  /**
   * Chamado pelo service no loop genÃ©rico (uma vez por query).
   * Funciona normalmente para queries que faÃ§am sentido na VÃ³rtx.
   */
  async search(query: string): Promise<SearchHit[]> {
    const searchUrl = buildVortxDcmSearchUrl(query);
    let html: string;
    try {
      html = await fetchHtmlViaProxy(searchUrl);
    } catch {
      return [];
    }

    const hits = parseVortxDcmSearchHtml(html, searchUrl);
    return enrichWithDetailPages(hits);
  },

  /**
   * Chamado UMA VEZ pelo service antes do loop genÃ©rico.
   * Gera queries otimizadas para a VÃ³rtx e roda todas sequencialmente,
   * parando assim que encontrar links de operaÃ§Ã£o.
   */
  async searchAll(input: AssetB3FinderInput): Promise<SearchHit[]> {
    const queries = buildVortxQueries(input);
    const allHits: SearchHit[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      const searchUrl = buildVortxDcmSearchUrl(query);
      let html: string;
      try {
        html = await fetchHtmlViaProxy(searchUrl);
      } catch {
        continue;
      }

      const discovery = discoverOperationLinks(html);

      // Log discovery results (will be visible in service logs via hits)
      const hits = parseVortxDcmSearchHtml(html, searchUrl);

      // Deduplica por URL
      for (const hit of hits) {
        if (!seenUrls.has(hit.url)) {
          seenUrls.add(hit.url);
          allHits.push(hit);
        }
      }

      // Se encontrou links de operaÃ§Ã£o, nÃ£o precisa tentar mais queries
      if (discovery.operationLinks.length > 0) break;
    }

    // Enriquece com pÃ¡ginas de detalhe
    return enrichWithDetailPages(allHits);
  },
};

