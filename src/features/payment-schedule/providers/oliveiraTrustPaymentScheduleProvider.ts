import type {
  FetchScheduleInput,
  PaymentScheduleItem,
  PaymentScheduleProvider,
  ProviderFetchResult,
} from '../types';
import { fetchHtmlViaProxy } from '../fetchHtmlViaProxy';

const HOST_REGEX = /(?:^|\.)oliveiratrust\.com\.br$/i;
const API_BASE = 'https://services-ft.oliveiratrust.com.br/app/v1';
const PAGE_LIMIT = 50;
const MAX_PAGES = 50;

const HISTORICO_URL_REGEX =
  /^https?:\/\/(?:www\.)?oliveiratrust\.com\.br\/investidor\/ativos\/historico-valores\/(\d+)/i;

type OliveiraTrustHistoricoRow = {
  data?: string | null;
  tit?: number | string | null;
  titulo?: string | null;
  juros_pgto?: string | null;
  amort_pgto?: string | null;
  premio_pgto?: string | null;
  total_pgto?: string | null;
};

type OliveiraTrustHistoricoResponse = {
  success?: boolean;
  data?: {
    data?: OliveiraTrustHistoricoRow[] | null;
    total?: number | null;
  } | null;
};

export function buildOliveiraTrustHistoricoApiUrl(
  titleId: string | number,
  page = 1,
  limit = PAGE_LIMIT,
): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return `${API_BASE}/titulos/historico_pu/${titleId}?${params.toString()}`;
}

export function buildOliveiraTrustSearchApiUrl(
  busca: string,
  data: string,
  page = 1,
  limit = 20,
): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    data,
    busca,
  });
  return `${API_BASE}/titulos/historico_pu?${params.toString()}`;
}

export function formatOliveiraTrustDate(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) return input;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseOliveiraTrustNumber(raw: string | null | undefined): number {
  if (raw == null) return NaN;
  const cleaned = raw.trim().replace(/\s/g, '');
  if (!cleaned || cleaned === '--') return NaN;
  const value = Number(cleaned.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
}

export function parseOliveiraTrustHistoricoJson(text: string): PaymentScheduleItem[] {
  let parsed: OliveiraTrustHistoricoResponse;
  try {
    parsed = JSON.parse(text) as OliveiraTrustHistoricoResponse;
  } catch {
    return [];
  }

  const rows = Array.isArray(parsed?.data?.data) ? parsed.data.data : [];
  const items: PaymentScheduleItem[] = [];
  for (const row of rows) {
    if (!row?.data || row.total_pgto == null) continue;
    const total = parseOliveiraTrustNumber(row.total_pgto);
    if (!Number.isFinite(total) || total <= 0) continue;

    items.push({
      date: formatOliveiraTrustDate(row.data),
      total: row.total_pgto,
    });
  }
  return items;
}

function parseOliveiraTrustHistoricoResponse(text: string): {
  rows: OliveiraTrustHistoricoRow[];
  total: number;
} {
  let parsed: OliveiraTrustHistoricoResponse;
  try {
    parsed = JSON.parse(text) as OliveiraTrustHistoricoResponse;
  } catch {
    return { rows: [], total: 0 };
  }

  return {
    rows: Array.isArray(parsed?.data?.data) ? parsed.data.data : [],
    total: typeof parsed?.data?.total === 'number' ? parsed.data.total : 0,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function titleIdFromUrl(url: URL): string | null {
  const historico = url.href.match(HISTORICO_URL_REGEX);
  if (historico) return historico[1];

  if (url.pathname === '/investidor/ativo') {
    const id = url.searchParams.get('id');
    return id && /^\d+$/.test(id) ? id : null;
  }

  return null;
}

function searchCodeFromInput(input: FetchScheduleInput, url: URL): string | null {
  const fromQuery = url.searchParams.get('busca')?.trim();
  if (fromQuery) return fromQuery;

  const fromAsset = String(input.asset.b3Code || '').trim();
  return fromAsset || null;
}

export async function resolveOliveiraTrustTitleId(
  input: FetchScheduleInput,
): Promise<string | null> {
  const rawUrl = (input.fiduciaryAgentUrl || '').trim();
  if (!rawUrl) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  const directId = titleIdFromUrl(parsedUrl);
  if (directId) return directId;

  const busca = searchCodeFromInput(input, parsedUrl);
  if (!busca) return null;

  const baseDate = todayIso();
  for (let daysBack = 0; daysBack < 10; daysBack++) {
    const data = addDaysIso(baseDate, -daysBack);
    const text = await fetchHtmlViaProxy(buildOliveiraTrustSearchApiUrl(busca, data));
    const { rows } = parseOliveiraTrustHistoricoResponse(text);
    const match = rows.find((row) => {
      const id = row.tit == null ? '' : String(row.tit);
      const title = row.titulo || '';
      return id && title.toUpperCase().includes(busca.toUpperCase());
    }) ?? rows.find((row) => row.tit != null);

    if (match?.tit != null) return String(match.tit);
  }

  return null;
}

export const oliveiraTrustPaymentScheduleProvider: PaymentScheduleProvider = {
  name: 'oliveira-trust',
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
    const titleId = await resolveOliveiraTrustTitleId(input);
    if (!titleId) {
      throw new Error(
        'URL Oliveira Trust não reconhecida. Cole o link de "historico-valores/{id}", "ativo?id=..." ou "ativos?busca=...".',
      );
    }

    const items: PaymentScheduleItem[] = [];
    let total = 0;
    let claimedB3Code: string | null = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const text = await fetchHtmlViaProxy(
        buildOliveiraTrustHistoricoApiUrl(titleId, page, PAGE_LIMIT),
      );
      items.push(...parseOliveiraTrustHistoricoJson(text));

      const { rows, total: responseTotal } = parseOliveiraTrustHistoricoResponse(text);
      total = responseTotal;
      if (claimedB3Code == null) {
        // O `titulo` retornado pela API contém o código IF junto ao apelido.
        // Procuramos o primeiro token que pareça com um IF (ex.: CRA025008SY).
        for (const row of rows) {
          const titulo = (row.titulo || '').toUpperCase();
          const m = /\b([A-Z]{2,4}\d{6,12}[A-Z0-9]*)\b/.exec(titulo);
          if (m) { claimedB3Code = m[1]; break; }
        }
      }
      if (rows.length === 0 || page >= Math.ceil(total / PAGE_LIMIT)) break;
    }

    return { items, claimedB3Code };
  },
};
