import { describe, it, expect } from 'vitest';
import {
  ecoagroPaymentScheduleProvider,
  parseEcoagroHistoricoPuHtml,
  parseEcoagroTotal,
  resolveEcoagroHistoricoUrl,
  buildEcoagroHistoricoUrl,
} from '../../../services/paymentSchedule/providers/ecoagroPaymentScheduleProvider';

const HISTORICO_HTML_BASE = `
<!doctype html>
<html><body>
<table>
  <thead>
    <tr>
      <th rowspan="2">DATA</th>
      <th colspan="3">PU</th>
      <th colspan="3">PAGAMENTOS</th>
    </tr>
    <tr>
      <th>UNITÁRIO</th>
      <th>TAXA</th>
      <th>TOTAL</th>
      <th>JUROS</th>
      <th>AMORTIZAÇÃO</th>
      <th>TOTAL</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>15.04.2026</td>
      <td>1.000,00000000</td>
      <td>0,00000000</td>
      <td>1.000,00000000</td>
      <td>12,41774000</td>
      <td>0,00000000</td>
      <td>12,41774000</td>
    </tr>
    <tr>
      <td>15.05.2026</td>
      <td>1.000,00000000</td>
      <td>0,00000000</td>
      <td>1.000,00000000</td>
      <td>0,00000000</td>
      <td>0,00000000</td>
      <td>0,00000000</td>
    </tr>
    <tr>
      <td>15.06.2026</td>
      <td>1.000,00000000</td>
      <td>0,00000000</td>
      <td>1.000,00000000</td>
      <td>11,11111111</td>
      <td>500,00000000</td>
      <td>511,11111111</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

describe('parseEcoagroTotal', () => {
  it('converte valor pt-BR com 8 casas em number', () => {
    expect(parseEcoagroTotal('12,41774000')).toBeCloseTo(12.41774, 8);
  });

  it('converte valor com separador de milhar', () => {
    expect(parseEcoagroTotal('1.234,56')).toBeCloseTo(1234.56, 6);
  });

  it('zero exato', () => {
    expect(parseEcoagroTotal('0,00000000')).toBe(0);
  });

  it('retorna NaN para entrada inválida', () => {
    expect(Number.isNaN(parseEcoagroTotal('abc'))).toBe(true);
  });
});

describe('parseEcoagroHistoricoPuHtml', () => {
  it('extrai apenas linhas com TOTAL (PAGAMENTOS) > 0, preservando data e precisão', () => {
    const items = parseEcoagroHistoricoPuHtml(HISTORICO_HTML_BASE);
    expect(items).toEqual([
      { date: '15.04.2026', total: '12,41774000' },
      { date: '15.06.2026', total: '511,11111111' },
    ]);
  });

  it('retorna array vazio se a tabela não tiver coluna TOTAL', () => {
    const html = `<table><thead><tr><th>DATA</th><th>VALOR</th></tr></thead>
      <tbody><tr><td>15.04.2026</td><td>10,00</td></tr></tbody></table>`;
    expect(parseEcoagroHistoricoPuHtml(html)).toEqual([]);
  });

  it('cai no fallback "último TOTAL" quando não há agrupamento PAGAMENTOS', () => {
    const html = `
      <table>
        <thead><tr><th>DATA</th><th>JUROS</th><th>TOTAL</th></tr></thead>
        <tbody>
          <tr><td>01.01.2026</td><td>0,00</td><td>0,00</td></tr>
          <tr><td>02.01.2026</td><td>5,00</td><td>5,00</td></tr>
        </tbody>
      </table>`;
    expect(parseEcoagroHistoricoPuHtml(html)).toEqual([
      { date: '02.01.2026', total: '5,00' },
    ]);
  });
});

describe('resolveEcoagroHistoricoUrl', () => {
  it('aceita URL direta de histórico-pu', () => {
    const url = resolveEcoagroHistoricoUrl({
      fiduciaryAgentUrl: 'https://ecoagro.agr.br/historico-pu/662/CRA025008SY',
      asset: { code: 'CRA025008SY', nickName: 'Teste' },
    });
    expect(url).toBe('https://ecoagro.agr.br/historico-pu/662/CRA025008SY');
  });

  it('sintetiza URL a partir de emissoes-integra preferindo b3Code', () => {
    const url = resolveEcoagroHistoricoUrl({
      fiduciaryAgentUrl: 'https://ecoagro.agr.br/emissoes-integra/662',
      asset: { code: 68984435, nickName: 'CRA JF', b3Code: 'CRA025008SY' },
    });
    expect(url).toBe('https://ecoagro.agr.br/historico-pu/662/CRA025008SY');
  });

  it('cai em asset.code quando b3Code não está presente', () => {
    const url = resolveEcoagroHistoricoUrl({
      fiduciaryAgentUrl: 'https://ecoagro.agr.br/emissoes-integra/662',
      asset: { code: 'CRA025008SY', nickName: 'Teste' },
    });
    expect(url).toBe('https://ecoagro.agr.br/historico-pu/662/CRA025008SY');
  });

  it('retorna null para URL não-Ecoagro', () => {
    const url = resolveEcoagroHistoricoUrl({
      fiduciaryAgentUrl: 'https://app.opea.com.br/pt/emissoes/123',
      asset: { code: 'X', nickName: 'Teste' },
    });
    expect(url).toBeNull();
  });

  it('retorna null para emissoes-integra sem asset.code nem b3Code', () => {
    const url = resolveEcoagroHistoricoUrl({
      fiduciaryAgentUrl: 'https://ecoagro.agr.br/emissoes-integra/662',
      asset: { code: '', nickName: 'Teste' },
    });
    expect(url).toBeNull();
  });
});

describe('buildEcoagroHistoricoUrl', () => {
  it('formata segundo o padrão esperado', () => {
    expect(buildEcoagroHistoricoUrl('662', 'CRA025008SY')).toBe(
      'https://ecoagro.agr.br/historico-pu/662/CRA025008SY',
    );
  });
});

describe('ecoagroPaymentScheduleProvider.canHandle', () => {
  const ref = { code: 'CRA025008SY', nickName: 'Teste' };

  it('aceita qualquer URL do host ecoagro.agr.br', () => {
    expect(
      ecoagroPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://ecoagro.agr.br/emissoes-integra/662',
        asset: ref,
      }),
    ).toBe(true);
    expect(
      ecoagroPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://www.ecoagro.agr.br/qualquer/coisa',
        asset: ref,
      }),
    ).toBe(true);
  });

  it('rejeita outros hosts', () => {
    expect(
      ecoagroPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://app.opea.com.br/pt/emissoes/123',
        asset: ref,
      }),
    ).toBe(false);
    expect(
      ecoagroPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: '',
        asset: ref,
      }),
    ).toBe(false);
  });
});
