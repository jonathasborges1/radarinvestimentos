/**
 * Utilitários de formatação para o padrão brasileiro (pt-BR).
 *
 * Usa as APIs nativas Intl.DateTimeFormat e Intl.NumberFormat para garantir
 * formatação consistente de datas, moedas e números.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const EM_DASH = '—';

/**
 * Formata uma string de data ISO para o padrão brasileiro dd/mm/aaaa.
 * Retorna "—" para valores nulos, undefined ou datas inválidas.
 */
export function formatDate(date: string | null | undefined): string {
  if (date == null || date === '') return EM_DASH;

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return EM_DASH;

  return dateFormatter.format(parsed);
}

/**
 * Formata um valor numérico no padrão monetário brasileiro (R$ X.XXX,XX).
 * Retorna "—" para valores nulos, undefined ou NaN.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return EM_DASH;

  return currencyFormatter.format(value);
}

/**
 * Formata um valor numérico no padrão monetário brasileiro preservando
 * todas as casas decimais significativas (até 8). Útil para valores de
 * pagamento da agenda fiduciária (ex.: 13,99627600 não pode virar 14,00).
 *
 * - Mantém separador de milhar pt-BR (ponto) e decimal vírgula.
 * - Não trunca: usa exatamente as casas decimais que o número tem,
 *   no mínimo 2 (para visual consistente em valores "redondos").
 */
export function formatCurrencyExact(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return EM_DASH;

  const decimals = countDecimals(value);
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Math.max(2, decimals),
    maximumFractionDigits: Math.max(2, decimals),
  });
  return formatter.format(value);
}

function countDecimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // toFixed(8) preserva precisão e remove notação científica.
  // Em seguida tiramos zeros à direita.
  const s = n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Formata um valor numérico com separador de milhar brasileiro (ponto).
 * Retorna "—" para valores nulos, undefined ou NaN.
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return EM_DASH;

  return numberFormatter.format(value);
}

/**
 * Retorna uma representação segura para exibição de qualquer valor.
 * Retorna "—" para null, undefined ou string vazia.
 * Para outros valores, retorna String(value).
 */
export function displayValue(value: unknown): string {
  if (value == null || value === '') return EM_DASH;

  return String(value);
}
