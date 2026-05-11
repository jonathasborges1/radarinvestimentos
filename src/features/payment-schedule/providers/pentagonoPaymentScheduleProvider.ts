import type {
  FetchScheduleInput,
  PaymentScheduleItem,
  PaymentScheduleProvider,
  ProviderFetchResult,
} from '../types';
import { fetchHtmlViaProxy } from '../fetchHtmlViaProxy';

/**
 * Padrões aceitos:
 *   - https://www.pentagonotrustee.com.br/Site/DetalhesEmissor?ativo={ativo}[&...]
 *   - https://www.pentagonotrustee.com.br[/Site[/DetalhesEmissor]]
 *     (usa `asset.b3Code` como `ativo`)
 *
 * A página renderiza SSR a aba "Pagamentos" (tab-5) quando recebe
 * `aba=tab-5&tipo=3`, com a tabela completa de eventos do título.
 *
 * Persistimos somente eventos com `Evento === "Juros"` e `data <= hoje`
 * (não captamos pagamentos futuros). O valor extraído é a coluna VALOR.
 */
const HOST_REGEX = /(?:^|\.)pentagonotrustee\.com\.br$/i;

const ATIVO_URL_REGEX =
  /^https?:\/\/(?:www\.)?pentagonotrustee\.com\.br\/Site\/DetalhesEmissor\?(?:[^#]*&)?ativo=([^&#]+)/i;

export function buildPentagonoEventosUrl(ativo: string): string {
  const params = new URLSearchParams({
    lp: '1000',
    ativo,
    aba: 'tab-5',
    tipo: '3',
  });
  return `https://www.pentagonotrustee.com.br/Site/DetalhesEmissor?${params.toString()}`;
}

function resolvePentagonoAtivo(input: FetchScheduleInput): string | null {
  const url = (input.fiduciaryAgentUrl || '').trim();
  if (url) {
    const m = url.match(ATIVO_URL_REGEX);
    if (m) return decodeURIComponent(m[1]);
  }
  const b3 = String(input.asset.b3Code || '').trim();
  return b3 || null;
}

/**
 * Decodifica as entidades HTML que a página utiliza nas células
 * (ex.: `Amortiza&#231;&#227;o` → `Amortização`).
 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Parse `DD/MM/YYYY` → Date local. Retorna `null` em formatos inválidos. */
function parsePentagonoDate(input: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** "9,36480000" / "1.000,00000000" → number. */
export function parsePentagonoValue(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Extrai apenas eventos de juros já realizados (data ≤ hoje) da aba "tab-5"
 * de uma página DetalhesEmissor.
 */
export function parsePentagonoTab5Html(
  html: string,
  now: Date = new Date(),
): PaymentScheduleItem[] {
  const tabIdx = html.indexOf('id="tab-5"');
  if (tabIdx < 0) return [];

  const tbodyIdx = html.indexOf('<tbody>', tabIdx);
  if (tbodyIdx < 0) return [];
  const tbodyEnd = html.indexOf('</tbody>', tbodyIdx);
  if (tbodyEnd < 0) return [];
  const tbody = html.substring(tbodyIdx, tbodyEnd);

  // "Hoje" sem componente de hora: garante que pagamentos do dia atual
  // sejam considerados passados.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items: PaymentScheduleItem[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()),
    );
    if (cells.length < 4) continue;
    const [date, evento, , valor] = cells;
    if (!/^juros$/i.test(evento)) continue;
    const parsed = parsePentagonoDate(date);
    if (!parsed) continue;
    if (parsed > today) continue; // ignora futuros
    if (!valor) continue;
    const num = parsePentagonoValue(valor);
    if (!Number.isFinite(num) || num <= 0) continue;
    items.push({ date, total: valor });
  }
  return items;
}

export const pentagonoPaymentScheduleProvider: PaymentScheduleProvider = {
  name: 'pentagono',
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
    const ativo = resolvePentagonoAtivo(input);
    if (!ativo) {
      throw new Error(
        'URL Pentágono não reconhecida. Cole o link com "?ativo=..." ou preencha o código do ativo no Código B3.',
      );
    }
    const html = await fetchHtmlViaProxy(buildPentagonoEventosUrl(ativo));
    const items = parsePentagonoTab5Html(html);
    return { items, claimedB3Code: ativo };
  },
};
