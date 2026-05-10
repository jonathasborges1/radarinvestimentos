import { describe, it, expect } from 'vitest';
import {
  buildVortxBuscaUrl,
  buildVortxHistoricoApiUrl,
  extractVortxOperationIdFromHtml,
  formatVortxDate,
  formatVortxTotal,
  parseVortxHistoricoJson,
  vortxPaymentScheduleProvider,
} from '../../../services/paymentSchedule/providers/vortxPaymentScheduleProvider';

describe('buildVortxHistoricoApiUrl', () => {
  it('monta a URL da API a partir de um operationId', () => {
    expect(buildVortxHistoricoApiUrl(94320)).toBe(
      'https://apis.vortx.com.br/vxsite/api/operacao/94320/preco-unitario/historico-pagamentos',
    );
  });
});

describe('buildVortxBuscaUrl', () => {
  it('monta a URL de busca a partir do código IF', () => {
    expect(buildVortxBuscaUrl('CRA02500001')).toBe(
      'https://www.vortx.com.br/investidor/dcm?busca=CRA02500001',
    );
  });

  it('faz encodeURIComponent em códigos com caracteres especiais', () => {
    expect(buildVortxBuscaUrl('A B/C')).toBe(
      'https://www.vortx.com.br/investidor/dcm?busca=A%20B%2FC',
    );
  });
});

describe('extractVortxOperationIdFromHtml', () => {
  it('extrai o id quando o ifCode aparece logo após "id" sem escape', () => {
    const html = `whatever {"id":94320,"nickname":"BOA SAFRA","ifCode":"CRA02500001"} more`;
    expect(extractVortxOperationIdFromHtml(html, 'CRA02500001')).toBe('94320');
  });

  it('extrai o id quando as aspas estão escapadas (RSC stream)', () => {
    const html = `prefix \\"id\\":94320,\\"nickname\\":\\"BOA SAFRA\\",\\"ifCode\\":\\"CRA02500001\\" suffix`;
    expect(extractVortxOperationIdFromHtml(html, 'CRA02500001')).toBe('94320');
  });

  it('retorna null quando o ifCode não está presente', () => {
    const html = `{"id":94320,"ifCode":"OUTRA"}`;
    expect(extractVortxOperationIdFromHtml(html, 'CRA02500001')).toBeNull();
  });
});

describe('formatVortxDate', () => {
  it('converte ISO completo para DD/MM/YYYY', () => {
    expect(formatVortxDate('2026-04-15T00:00:00')).toBe('15/04/2026');
  });

  it('converte ISO só com data', () => {
    expect(formatVortxDate('2025-12-31')).toBe('31/12/2025');
  });

  it('preserva entrada não-ISO', () => {
    expect(formatVortxDate('15.04.2026')).toBe('15.04.2026');
  });
});

describe('formatVortxTotal', () => {
  it('formata número com 8 casas decimais e vírgula', () => {
    expect(formatVortxTotal(12.015155)).toBe('12,01515500');
  });

  it('preserva precisão completa', () => {
    expect(formatVortxTotal(0.00000001)).toBe('0,00000001');
  });
});

describe('parseVortxHistoricoJson', () => {
  it('filtra por TOTAL > 0 e persiste interestValue (Valor dos Juros) como valor', () => {
    const json = JSON.stringify({
      unitPrices: [
        { paymentDate: '2025-01-15T00:00:00', total: 0, interestValue: 0.66 },
        { paymentDate: '2025-04-15T00:00:00', total: 12.015155, interestValue: 12.015155 },
        { paymentDate: '2025-05-15T00:00:00', total: 10.864662, interestValue: 10.864662 },
        { paymentDate: '2025-06-15T00:00:00', total: 0, interestValue: 0 },
      ],
    });
    expect(parseVortxHistoricoJson(json)).toEqual([
      { date: '15/04/2025', total: '12,01515500' },
      { date: '15/05/2025', total: '10,86466200' },
    ]);
  });

  it('em datas com juros + amortização, grava só os juros (não o total)', () => {
    const json = JSON.stringify({
      unitPrices: [
        // total = juros + amortização, interestValue = só juros
        { paymentDate: '2026-04-15', total: 25.5, interestValue: 13.99627600 },
      ],
    });
    expect(parseVortxHistoricoJson(json)).toEqual([
      { date: '15/04/2026', total: '13,99627600' },
    ]);
  });

  it('cai no total quando interestValue está ausente', () => {
    const json = JSON.stringify({
      unitPrices: [
        { paymentDate: '2025-04-15', total: 12.015155 }, // sem interestValue
      ],
    });
    expect(parseVortxHistoricoJson(json)).toEqual([
      { date: '15/04/2025', total: '12,01515500' },
    ]);
  });

  it('aceita total e interestValue como string numérica', () => {
    const json = JSON.stringify({
      unitPrices: [{ paymentDate: '2025-04-15', total: '12.015155', interestValue: '12.015155' }],
    });
    expect(parseVortxHistoricoJson(json)).toEqual([
      { date: '15/04/2025', total: '12,01515500' },
    ]);
  });

  it('retorna [] para JSON inválido ou sem unitPrices', () => {
    expect(parseVortxHistoricoJson('not json')).toEqual([]);
    expect(parseVortxHistoricoJson('{}')).toEqual([]);
    expect(parseVortxHistoricoJson('{"unitPrices":null}')).toEqual([]);
  });

  it('ignora linhas sem paymentDate ou com total não-finito', () => {
    const json = JSON.stringify({
      unitPrices: [
        { paymentDate: null, total: 10 },
        { paymentDate: '2025-04-15', total: null },
        { paymentDate: '2025-04-15', total: 'abc' },
        { paymentDate: '2025-04-15', total: -5 },
      ],
    });
    expect(parseVortxHistoricoJson(json)).toEqual([]);
  });
});

describe('vortxPaymentScheduleProvider.canHandle', () => {
  it('aceita www.vortx.com.br', () => {
    expect(
      vortxPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://www.vortx.com.br/investidor/dcm/operacao?id=94320',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(true);
  });

  it('aceita vortx.com.br sem www', () => {
    expect(
      vortxPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://vortx.com.br/investidor/dcm',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(true);
  });

  it('rejeita outros hosts', () => {
    expect(
      vortxPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://ecoagro.agr.br/historico-pu/1/X',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(false);
  });

  it('rejeita URL vazia', () => {
    expect(
      vortxPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: '',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(false);
  });
});
