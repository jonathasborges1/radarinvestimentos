import type {
  FetchScheduleInput,
  PaymentScheduleItem,
  PaymentScheduleProvider,
  ProviderFetchResult,
} from '../types';
import { fetchHtmlViaProxy } from '../fetchHtmlViaProxy';

/**
 * Padrões aceitos:
 *   - https://ecoagro.agr.br/historico-pu/{emissionId}/{assetCode}
 *   - https://ecoagro.agr.br/emissoes-integra/{emissionId}
 *
 * Quando recebemos a URL de emissão, sintetizamos a URL do histórico
 * usando `asset.code`. Isso evita exigir um novo campo `emissionId`
 * no modelo do ativo (baixo risco, conforme combinado).
 */
const HISTORICO_URL_REGEX =
  /^https?:\/\/(?:www\.)?ecoagro\.agr\.br\/historico-pu\/(\d+)\/([A-Za-z0-9]+)/i;

const EMISSAO_URL_REGEX =
  /^https?:\/\/(?:www\.)?ecoagro\.agr\.br\/emissoes-integra\/(\d+)/i;

const HOST_REGEX = /(?:^|\.)ecoagro\.agr\.br$/i;

export function buildEcoagroHistoricoUrl(
  emissionId: string,
  assetCode: string,
): string {
  return `https://ecoagro.agr.br/historico-pu/${emissionId}/${assetCode}`;
}

export function resolveEcoagroHistoricoUrl(
  input: FetchScheduleInput,
): string | null {
  const url = (input.fiduciaryAgentUrl || '').trim();
  if (!url) return null;

  const direct = url.match(HISTORICO_URL_REGEX);
  if (direct) {
    const [, emissionId, assetCodeFromUrl] = direct;
    return buildEcoagroHistoricoUrl(emissionId, assetCodeFromUrl);
  }

  const emissao = url.match(EMISSAO_URL_REGEX);
  if (emissao) {
    const [, emissionId] = emissao;
    // Preferimos o `b3Code` (ticker, ex.: "CRA025008SY") porque o
    // `code` da Itaú é numérico interno e não bate com o caminho
    // `/historico-pu/{emissionId}/{ticker}` da Ecoagro.
    const ticker = String(input.asset.b3Code || '').trim();
    const fallback = String(input.asset.code || '').trim();
    const assetCode = ticker || fallback;
    if (!assetCode) return null;
    return buildEcoagroHistoricoUrl(emissionId, assetCode);
  }

  return null;
}

/**
 * Converte "12,41774000" ou "1.234,56" em number para comparação.
 * Mantém o original como string para exibição.
 */
export function parseEcoagroTotal(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

type HeaderMatrix = string[][];

function buildHeaderMatrix(table: HTMLTableElement): HeaderMatrix {
  const headerRows = Array.from(
    table.querySelectorAll<HTMLTableRowElement>(':scope > thead > tr'),
  );
  if (headerRows.length === 0) {
    // Fallback: alguns sites colocam <tr> com <th> direto no <table> sem <thead>.
    const firstRow = table.querySelector<HTMLTableRowElement>(':scope > tr');
    if (firstRow && firstRow.querySelector('th')) headerRows.push(firstRow);
  }

  const matrix: HeaderMatrix = [];
  for (let r = 0; r < headerRows.length; r++) matrix[r] = [];

  for (let r = 0; r < headerRows.length; r++) {
    const cells = Array.from(headerRows[r].children) as HTMLTableCellElement[];
    let c = 0;
    for (const cell of cells) {
      while (matrix[r][c] !== undefined) c++;
      const text = (cell.textContent || '').trim().toUpperCase();
      const colspan = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
      const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10));
      for (let dr = 0; dr < rowspan; dr++) {
        const rowIdx = r + dr;
        if (!matrix[rowIdx]) matrix[rowIdx] = [];
        for (let dc = 0; dc < colspan; dc++) {
          matrix[rowIdx][c + dc] = text;
        }
      }
      c += colspan;
    }
  }
  return matrix;
}

function columnPaths(matrix: HeaderMatrix): string[][] {
  const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  const paths: string[][] = [];
  for (let c = 0; c < colCount; c++) {
    const path: string[] = [];
    for (let r = 0; r < matrix.length; r++) {
      const cell = matrix[r]?.[c];
      if (cell && (path.length === 0 || path[path.length - 1] !== cell)) {
        path.push(cell);
      }
    }
    paths.push(path);
  }
  return paths;
}

function findDateColumn(paths: string[][]): number {
  // Procura coluna cujo nome final é "DATA" (sem agrupamento de pagamento).
  for (let i = 0; i < paths.length; i++) {
    const leaf = paths[i][paths[i].length - 1];
    if (leaf === 'DATA') return i;
  }
  // Fallback: qualquer coluna que contenha DATA.
  for (let i = 0; i < paths.length; i++) {
    if (paths[i].some(p => /\bDATA\b/.test(p))) return i;
  }
  return -1;
}

function findTotalColumn(paths: string[][]): number {
  // Preferência: coluna TOTAL dentro do agrupamento PAGAMENTOS.
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const leaf = path[path.length - 1];
    const hasPagamentosGroup = path.some(p => /PAGAMENTOS?/.test(p));
    if (leaf === 'TOTAL' && hasPagamentosGroup) return i;
  }
  // Fallback: último TOTAL da tabela (geralmente o agregado de pagamento).
  let last = -1;
  for (let i = 0; i < paths.length; i++) {
    if (paths[i][paths[i].length - 1] === 'TOTAL') last = i;
  }
  return last;
}

/**
 * Extrai itens da tabela de histórico PU da Ecoagro.
 * - Mantém data e valor como vieram do site.
 * - Filtra somente linhas com TOTAL > 0.
 */
export function parseEcoagroHistoricoPuHtml(html: string): PaymentScheduleItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));

  for (const table of tables) {
    const matrix = buildHeaderMatrix(table);
    if (matrix.length === 0) continue;
    const paths = columnPaths(matrix);
    const dateIdx = findDateColumn(paths);
    const totalIdx = findTotalColumn(paths);
    if (dateIdx < 0 || totalIdx < 0) continue;

    const bodyRows = Array.from(
      table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'),
    );
    // Fallback: sites simples às vezes não usam <tbody>.
    const rows =
      bodyRows.length > 0
        ? bodyRows
        : Array.from(table.querySelectorAll<HTMLTableRowElement>(':scope > tr')).slice(
            matrix.length,
          );

    const items: PaymentScheduleItem[] = [];
    for (const row of rows) {
      const cells = Array.from(row.children) as HTMLTableCellElement[];
      if (cells.length <= Math.max(dateIdx, totalIdx)) continue;

      const date = (cells[dateIdx].textContent || '').trim();
      const total = (cells[totalIdx].textContent || '').trim();
      if (!date || !total) continue;

      const numeric = parseEcoagroTotal(total);
      if (!Number.isFinite(numeric) || numeric <= 0) continue;

      items.push({ date, total });
    }
    if (items.length > 0) return items;
  }

  return [];
}

export const ecoagroPaymentScheduleProvider: PaymentScheduleProvider = {
  name: 'ecoagro',
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
    const target = resolveEcoagroHistoricoUrl(input);
    if (!target) {
      throw new Error(
        'URL Ecoagro não reconhecida. Cole o link de "historico-pu/{emissionId}/{codigo}" ou "emissoes-integra/{emissionId}".',
      );
    }
    // O ticker (último segmento do path) é o código IF do ativo na Ecoagro.
    const claimedMatch = target.match(/\/historico-pu\/\d+\/([A-Za-z0-9]+)/i);
    const claimedB3Code = claimedMatch ? claimedMatch[1] : null;

    const html = await fetchHtmlViaProxy(target);
    return { items: parseEcoagroHistoricoPuHtml(html), claimedB3Code };
  },
};
