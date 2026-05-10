import { describe, expect, it } from 'vitest';
import type { PaymentEvent } from '../../../types';
import { sortPaymentsNewestFirst } from '../../../utils/paymentMetrics';

describe('sortPaymentsNewestFirst', () => {
  it('orders payments from newest to oldest across supported date formats', () => {
    const payments: PaymentEvent[] = [
      { date: '15/04/2026', type: 'Pagamento', value: 10 },
      { date: 'invalid', type: 'Pagamento', value: 99 },
      { date: '2026-05-10', type: 'Pagamento', value: 20 },
      { date: '20.03.2026', type: 'Pagamento', value: 30 },
    ];

    expect(sortPaymentsNewestFirst(payments).map((p) => p.date)).toEqual([
      '2026-05-10',
      '15/04/2026',
      '20.03.2026',
      'invalid',
    ]);
  });

  it('does not mutate the original array', () => {
    const payments: PaymentEvent[] = [
      { date: '01/01/2025', type: 'Pagamento', value: 1 },
      { date: '01/01/2026', type: 'Pagamento', value: 2 },
    ];

    sortPaymentsNewestFirst(payments);

    expect(payments.map((p) => p.date)).toEqual(['01/01/2025', '01/01/2026']);
  });
});
