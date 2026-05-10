import type {
  FetchScheduleInput,
  PaymentScheduleItem,
  PaymentScheduleProvider,
  ProviderFetchResult,
} from '../types';
import { fetchHtmlViaProxy } from '../fetchHtmlViaProxy';

/**
 * Padrões aceitos:
 *   - https://www.vortx.com.br/investidor/dcm/operacao?id={operationId}
 *   - https://www.vortx.com.br/investidor/dcm?busca={ifCode}
 *   - https://www.vortx.com.br/investidor/dcm  (usa `asset.b3Code` como ifCode)
 *
 * O histórico de pagamentos vive em uma API pública JSON:
 *   https://apis.vortx.com.br/vxsite/api/operacao/{id}/preco-unitario/historico-pagamentos
 *
 * Quando recebemos uma URL de busca (ou só a base do DCM), fazemos um round-trip
 * pela página de busca SSR, que embute o `id` da operação no payload RSC do
 * Next.js junto ao `ifCode` correspondente.
 */
const HOST_REGEX = /(?:^|\.)vortx\.com\.br$/i;

const OPERACAO_URL_REGEX =
  /^https?:\/\/(?:www\.)?vortx\.com\.br\/investidor\/dcm\/operacao\?(?:[^#]*&)?id=(\d+)/i;

const BUSCA_URL_REGEX =
  /^https?:\/\/(?:www\.)?vortx\.com\.br\/investidor\/dcm\/?\?(?:[^#]*&)?busca=([^&#]+)/i;

const DCM_BASE_REGEX =
  /^https?:\/\/(?:www\.)?vortx\.com\.br\/investidor\/dcm\/?$/i;

export function buildVortxHistoricoApiUrl(operationId: string | number): string {
  return `https://apis.vortx.com.br/vxsite/api/operacao/${operationId}/preco-unitario/historico-pagamentos`;
}

export function buildVortxBuscaUrl(ifCode: string): string {
  return `https://www.vortx.com.br/investidor/dcm?busca=${encodeURIComponent(ifCode)}`;
}

export function buildVortxOperacaoUrl(operationId: string | number): string {
  return `https://www.vortx.com.br/investidor/dcm/operacao?id=${operationId}`;
}

/**
 * Normaliza aspas escapadas (RSC stream): `\\"` → `"`, `\"` → `"`.
 * O HTML da Vortx usa um, dois ou nenhum nível de escape dependendo de onde
 * o objeto está embutido. Normalizar de uma vez evita regex frágeis.
 */
function unescapeRscQuotes(html: string): string {
  return html.replace(/\\+"/g, '"');
}

/**
 * Extrai o ifCode da página de operação da Vortx procurando o objeto
 * cujo `id` casa com o `operationId` informado, ou caindo em qualquer
 * `ifCode`/`numeroIf` próximo. Retorna `null` quando não encontra.
 */
export function extractVortxIfCodeFromOperacaoHtml(
  html: string,
  operationId: string | number,
): string | null {
  const normalized = unescapeRscQuotes(html);

  const tied = new RegExp(
    `"id"\\s*:\\s*${operationId}\\b[^{}]{0,400}?"ifCode"\\s*:\\s*"([^"]+)"`,
  );
  const m = tied.exec(normalized);
  if (m) return m[1];

  // Fallback 1: campo "numeroIf" presente em outras seções da página.
  const numeroIf = /"numeroIf"\s*:\s*"([^"]+)"/.exec(normalized);
  if (numeroIf) return numeroIf[1];

  // Fallback 2: primeiro "ifCode" da página.
  const anyIfCode = /"ifCode"\s*:\s*"([^"]+)"/.exec(normalized);
  return anyIfCode ? anyIfCode[1] : null;
}

/**
 * Extrai o operationId da página de busca SSR procurando um objeto cujo
 * `ifCode` casa com o código informado.
 *
 * O Next.js embute os dados como RSC stream, com aspas escapadas em alguns
 * trechos (`\"id\":NNNN,\"ifCode\":\"CRA…\"`). A regex aceita ambos.
 */
export function extractVortxOperationIdFromHtml(html: string, ifCode: string): string | null {
  const escapedCode = ifCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // "id":NNNN, ... "ifCode":"<code>"  (aspas podem estar escapadas com \")
  const re = new RegExp(
    String.raw`\\?"id\\?":\s*(\d+)\s*,[^}]{0,400}?\\?"ifCode\\?":\s*\\?"` + escapedCode + String.raw`\\?"`,
    'i',
  );
  const m = re.exec(html);
  return m ? m[1] : null;
}

/**
 * Resolve o operationId e, quando possível sem custo extra, o claimedB3Code.
 * - URL `/operacao?id=NNNN` → operationId direto (claim resolvido depois).
 * - URL `/dcm?busca=CODE`   → fetch da busca; ifCode usado é o `claim`.
 * - URL `/dcm` base + asset.b3Code → idem.
 */
async function resolveVortxOperationContext(
  input: FetchScheduleInput,
): Promise<{ operationId: string; claimedB3Code: string | null } | null> {
  const url = (input.fiduciaryAgentUrl || '').trim();
  if (!url) return null;

  const direct = url.match(OPERACAO_URL_REGEX);
  if (direct) return { operationId: direct[1], claimedB3Code: null };

  const busca = url.match(BUSCA_URL_REGEX);
  if (busca) {
    const ifCode = decodeURIComponent(busca[1]);
    const html = await fetchHtmlViaProxy(buildVortxBuscaUrl(ifCode));
    const operationId = extractVortxOperationIdFromHtml(html, ifCode);
    return operationId ? { operationId, claimedB3Code: ifCode } : null;
  }

  if (DCM_BASE_REGEX.test(url)) {
    const ifCode = String(input.asset.b3Code || '').trim();
    if (!ifCode) return null;
    const html = await fetchHtmlViaProxy(buildVortxBuscaUrl(ifCode));
    const operationId = extractVortxOperationIdFromHtml(html, ifCode);
    return operationId ? { operationId, claimedB3Code: ifCode } : null;
  }

  return null;
}

type VortxUnitPrice = {
  paymentDate?: string | null;
  /** Soma do dia (juros + amortização). Usado apenas como filtro de eventos. */
  total?: number | string | null;
  /** "Valor dos Juros" — montante de juros pagos no dia. É o que persistimos. */
  interestValue?: number | string | null;
};

type VortxHistoricoResponse = {
  unitPrices?: VortxUnitPrice[] | null;
};

/** "2026-04-15T00:00:00" → "15/04/2026". Outros formatos passam intactos. */
export function formatVortxDate(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return input;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Formata número como string pt-BR com 8 casas decimais para preservar
 * a precisão exibida pelo agente (ex.: 12.0151550 → "12,01515500").
 */
export function formatVortxTotal(value: number): string {
  return value.toFixed(8).replace('.', ',');
}

function toNumber(raw: number | string | null | undefined): number {
  if (raw == null) return NaN;
  return typeof raw === 'number' ? raw : Number(raw);
}

/**
 * Extrai pagamentos do histórico-pagamentos da Vortx.
 *
 * - Filtra linhas onde a coluna TOTAL é > 0 (identifica dias com pagamento real,
 *   ignorando linhas de mero acúmulo diário de juros).
 * - O valor persistido é `interestValue` (coluna "Valor dos Juros"), não `total`.
 *   Em datas só de juros, ambos são iguais; em datas com amortização, a Vortx
 *   soma os dois em `total` — aqui mantemos somente os juros, conforme regra
 *   de negócio (média de pagamento ÷ PU mínimo deve refletir só remuneração).
 */
export function parseVortxHistoricoJson(text: string): PaymentScheduleItem[] {
  let data: VortxHistoricoResponse;
  try {
    data = JSON.parse(text) as VortxHistoricoResponse;
  } catch {
    return [];
  }

  const rows = Array.isArray(data?.unitPrices) ? data.unitPrices : [];
  const items: PaymentScheduleItem[] = [];
  for (const row of rows) {
    if (!row || !row.paymentDate || row.total == null) continue;
    const totalNum = toNumber(row.total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) continue;

    // Valor a registrar = Valor dos Juros. Cai no total como fallback caso
    // o agente não retorne `interestValue` (estrutura defensiva).
    const interestNum = toNumber(row.interestValue);
    const valueToStore = Number.isFinite(interestNum) && interestNum > 0 ? interestNum : totalNum;

    items.push({
      date: formatVortxDate(String(row.paymentDate)),
      total: formatVortxTotal(valueToStore),
    });
  }
  return items;
}

export const vortxPaymentScheduleProvider: PaymentScheduleProvider = {
  name: 'vortx',
  canHandle(input: FetchScheduleInput): boolean {
    const url = (input.fiduciaryAgentUrl || '').trim();
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return HOST_REGEX.test(parsed.hostname);
    } catch {
      return false;
    }
  },
  async fetchSchedule(input: FetchScheduleInput): Promise<ProviderFetchResult> {
    const ctx = await resolveVortxOperationContext(input);
    if (!ctx) {
      throw new Error(
        'Não foi possível resolver o ID da operação Vortx. Cole a URL "/investidor/dcm/operacao?id=NNNN" ou preencha o código IF (B3) do ativo.',
      );
    }
    const { operationId } = ctx;
    let { claimedB3Code } = ctx;

    const text = await fetchHtmlViaProxy(buildVortxHistoricoApiUrl(operationId));
    const items = parseVortxHistoricoJson(text);

    // Quando a URL informada foi `/operacao?id=NNNN` (id opaco), buscamos a
    // página da operação para descobrir o ifCode declarado pelo agente.
    // Só pagamos esse round-trip extra quando o ativo tem b3Code para validar.
    const expectedB3Code = String(input.asset.b3Code || '').trim();
    if (claimedB3Code == null && expectedB3Code) {
      try {
        const opHtml = await fetchHtmlViaProxy(buildVortxOperacaoUrl(operationId));
        claimedB3Code = extractVortxIfCodeFromOperacaoHtml(opHtml, operationId);
      } catch {
        // Best-effort: silencia falhas da fetch de validação para não bloquear
        // o fluxo principal. claimedB3Code permanece null → caller trata como
        // "não verificado".
      }
    }

    return { items, claimedB3Code };
  },
};
