import { describe, it, expect } from 'vitest';
import {
  buildPentagonoEventosUrl,
  parsePentagonoTab5Html,
  parsePentagonoValue,
  pentagonoPaymentScheduleProvider,
} from '../../../services/paymentSchedule/providers/pentagonoPaymentScheduleProvider';

const TAB5_HTML = `
<!doctype html>
<html><body>
<div id="tab-1"></div>
<div id="tab-5">
  <table>
    <thead>
      <tr><th>Data</th><th>Evento</th><th>Taxa</th><th>Valor</th><th>Residual</th><th>Obs</th></tr>
    </thead>
    <tbody>
      <tr><td>14/04/2026</td><td>Juros</td><td>0,0000</td><td>3,69049000</td><td>1.000,000000000</td><td></td></tr>
      <tr><td>14/04/2026</td><td>Amortiza&#231;&#227;o Ordin&#225;ria</td><td>100,0000</td><td>1.000,00000000</td><td>0,000000000</td><td></td></tr>
      <tr><td>13/05/2026</td><td>Juros</td><td>0,0000</td><td>10,00635000</td><td>1.000,000000000</td><td></td></tr>
      <tr><td>10/05/2026</td><td>Juros</td><td>0,0000</td><td>5,12345600</td><td>1.000,000000000</td><td></td></tr>
      <tr><td>12/06/2026</td><td>Juros</td><td>0,0000</td><td>10,93411000</td><td>1.000,000000000</td><td></td></tr>
    </tbody>
  </table>
</div>
</body></html>
`;

describe('buildPentagonoEventosUrl', () => {
  it('monta URL com tab-5 e tipo=3', () => {
    expect(buildPentagonoEventosUrl('26C3164285')).toBe(
      'https://www.pentagonotrustee.com.br/Site/DetalhesEmissor?lp=1000&ativo=26C3164285&aba=tab-5&tipo=3',
    );
  });
});

describe('parsePentagonoValue', () => {
  it('parseia números com vírgula decimal e ponto de milhar', () => {
    expect(parsePentagonoValue('9,36480000')).toBe(9.3648);
    expect(parsePentagonoValue('1.000,00000000')).toBe(1000);
    expect(parsePentagonoValue(' 12,5 ')).toBe(12.5);
  });
});

describe('parsePentagonoTab5Html', () => {
  it('extrai apenas eventos de Juros com data <= hoje', () => {
    // Hoje fixado: 2026-05-10. Mantém 14/04/2026 (passado) e 10/05/2026 (hoje).
    // Descarta 13/05/2026 e 12/06/2026 (futuros) e a Amortização (evento != Juros).
    const items = parsePentagonoTab5Html(TAB5_HTML, new Date(2026, 4, 10));
    expect(items).toEqual([
      { date: '14/04/2026', total: '3,69049000' },
      { date: '10/05/2026', total: '5,12345600' },
    ]);
  });

  it('inclui pagamento que cai exatamente no dia atual', () => {
    const items = parsePentagonoTab5Html(TAB5_HTML, new Date(2026, 4, 10));
    expect(items.some((i) => i.date === '10/05/2026')).toBe(true);
  });

  it('exclui amortização ordinária (apenas Juros conta)', () => {
    const items = parsePentagonoTab5Html(TAB5_HTML, new Date(2030, 0, 1));
    // Já que today é 2030, todas as datas do mock são passadas.
    // Mas só os eventos "Juros" entram.
    expect(items.every((i) => i)).toBe(true);
    expect(items.filter((i) => i.total === '1.000,00000000')).toEqual([]);
  });

  it('retorna [] quando tab-5 não está presente', () => {
    expect(parsePentagonoTab5Html('<html><body><div id="tab-1"></div></body></html>')).toEqual([]);
  });

  it('retorna [] quando o tbody está vazio', () => {
    const html = '<div id="tab-5"><table><tbody></tbody></table></div>';
    expect(parsePentagonoTab5Html(html)).toEqual([]);
  });
});

describe('pentagonoPaymentScheduleProvider.canHandle', () => {
  it('aceita www.pentagonotrustee.com.br', () => {
    expect(
      pentagonoPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://www.pentagonotrustee.com.br/Site/DetalhesEmissor?ativo=26C3164285',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(true);
  });

  it('aceita pentagonotrustee.com.br sem www', () => {
    expect(
      pentagonoPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://pentagonotrustee.com.br/',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(true);
  });

  it('rejeita outros hosts', () => {
    expect(
      pentagonoPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://www.vortx.com.br/',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(false);
  });
});
