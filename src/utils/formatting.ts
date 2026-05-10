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
