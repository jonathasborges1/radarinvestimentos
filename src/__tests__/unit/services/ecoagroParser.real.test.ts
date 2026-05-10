import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEcoagroHistoricoPuHtml } from '../../../services/paymentSchedule/providers/ecoagroPaymentScheduleProvider';

const fixture = readFileSync(
  resolve(__dirname, '../../fixtures/ecoagro-cra025008sy.html'),
  'utf-8',
);

describe('Ecoagro parser — HTML real', () => {
  it('extrai pagamento de 15.04.2026 com TOTAL = 12,41774000', () => {
    const items = parseEcoagroHistoricoPuHtml(fixture);
    console.log('count =', items.length);
    console.log('first 5 =', items.slice(0, 5));
    expect(items.length).toBeGreaterThan(0);
    const target = items.find(i => i.date === '15.04.2026');
    expect(target).toBeDefined();
    expect(target?.total).toBe('12,41774000');
  });
});
