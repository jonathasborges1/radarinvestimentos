import type { PaymentEvent } from '../types';

export type PaymentRating = 'ruim' | 'regular' | 'excelente';

export type PaymentMetrics = {
  avg6m: number | null;
  avg12m: number | null;
  /** Razão = média / puMinValue (fração: 0,012 representa 1,2%). */
  ratio6m: number | null;
  ratio12m: number | null;
  /** Classificação baseada no melhor ratio disponível (preferindo 12m). */
  rating: PaymentRating | null;
  count6m: number;
  count12m: number;
};

const RATING_THRESHOLD_RUIM = 0.01;
const RATING_THRESHOLD_EXCELENTE = 0.012;

export function parsePaymentDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();

  // DD.MM.YYYY (formato Ecoagro)
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (dot) {
    const [, d, m, y] = dot;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // DD/MM/YYYY
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (slash) {
    const [, d, m, y] = slash;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // ISO (YYYY-MM-DD ou completo)
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function ratingFor(ratio: number): PaymentRating {
  if (ratio < RATING_THRESHOLD_RUIM) return 'ruim';
  if (ratio < RATING_THRESHOLD_EXCELENTE) return 'regular';
  return 'excelente';
}

function monthsAgo(now: Date, months: number): Date {
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
}

export function sortPaymentsNewestFirst(payments: PaymentEvent[]): PaymentEvent[] {
  return [...payments].sort((a, b) => {
    const dateA = parsePaymentDate(a.date)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const dateB = parsePaymentDate(b.date)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return dateB - dateA;
  });
}

/**
 * Calcula métricas dos pagamentos de um ativo.
 *
 * Considera apenas pagamentos com data <= hoje (paid/realizado), ignorando
 * eventos futuros agendados. A classificação compara o melhor ratio disponível
 * (preferindo 12m por estabilidade) contra os limites:
 *   - ratio < 1,0%  → "ruim"
 *   - 1,0% ≤ ratio < 1,2% → "regular"
 *   - ratio ≥ 1,2% → "excelente"
 */
export function computePaymentMetrics(
  payments: PaymentEvent[] | null | undefined,
  puMinValue: number | null | undefined,
  now: Date = new Date()
): PaymentMetrics {
  const cutoff6 = monthsAgo(now, 6);
  const cutoff12 = monthsAgo(now, 12);

  const values6: number[] = [];
  const values12: number[] = [];

  for (const p of payments ?? []) {
    const date = parsePaymentDate(p.date);
    if (!date || date > now) continue;
    if (p.value == null || !Number.isFinite(p.value)) continue;
    if (date >= cutoff12) values12.push(p.value);
    if (date >= cutoff6) values6.push(p.value);
  }

  const avg6m = average(values6);
  const avg12m = average(values12);

  const validPu = typeof puMinValue === 'number' && Number.isFinite(puMinValue) && puMinValue > 0;
  const ratio6m = validPu && avg6m != null ? avg6m / (puMinValue as number) : null;
  const ratio12m = validPu && avg12m != null ? avg12m / (puMinValue as number) : null;

  const ratioForRating = ratio12m ?? ratio6m;
  const rating = ratioForRating != null ? ratingFor(ratioForRating) : null;

  return {
    avg6m,
    avg12m,
    ratio6m,
    ratio12m,
    rating,
    count6m: values6.length,
    count12m: values12.length,
  };
}
