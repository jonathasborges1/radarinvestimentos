import { describe, expect, it } from 'vitest';
import {
  buildOliveiraTrustHistoricoApiUrl,
  buildOliveiraTrustSearchApiUrl,
  formatOliveiraTrustDate,
  parseOliveiraTrustHistoricoJson,
  parseOliveiraTrustNumber,
  oliveiraTrustPaymentScheduleProvider,
} from '../../../services/paymentSchedule/providers/oliveiraTrustPaymentScheduleProvider';

describe('buildOliveiraTrustHistoricoApiUrl', () => {
  it('monta a URL da API de histórico a partir do tit', () => {
    expect(buildOliveiraTrustHistoricoApiUrl(56891, 2, 50)).toBe(
      'https://services-ft.oliveiratrust.com.br/app/v1/titulos/historico_pu/56891?page=2&limit=50',
    );
  });
});

describe('buildOliveiraTrustSearchApiUrl', () => {
  it('monta a URL de busca por código IF e data', () => {
    expect(buildOliveiraTrustSearchApiUrl('24E2531061', '2026-05-10')).toBe(
      'https://services-ft.oliveiratrust.com.br/app/v1/titulos/historico_pu?page=1&limit=20&data=2026-05-10&busca=24E2531061',
    );
  });
});

describe('formatOliveiraTrustDate', () => {
  it('converte ISO para DD/MM/YYYY', () => {
    expect(formatOliveiraTrustDate('2026-04-15')).toBe('15/04/2026');
  });

  it('preserva formatos desconhecidos', () => {
    expect(formatOliveiraTrustDate('15.04.2026')).toBe('15.04.2026');
  });
});

describe('parseOliveiraTrustNumber', () => {
  it('converte número brasileiro em number', () => {
    expect(parseOliveiraTrustNumber('1.097,68849693')).toBe(1097.68849693);
  });

  it('retorna NaN para vazio, null e "--"', () => {
    expect(Number.isNaN(parseOliveiraTrustNumber(''))).toBe(true);
    expect(Number.isNaN(parseOliveiraTrustNumber(null))).toBe(true);
    expect(Number.isNaN(parseOliveiraTrustNumber('--'))).toBe(true);
  });
});

describe('parseOliveiraTrustHistoricoJson', () => {
  it('extrai apenas linhas com total_pgto positivo', () => {
    const json = JSON.stringify({
      success: true,
      data: {
        data: [
          { data: '2026-05-10', total_pgto: '0,00000000' },
          { data: '2026-04-15', total_pgto: '7,04340359' },
          { data: '2026-03-16', total_pgto: '5,98177597' },
          { data: '2026-03-15', total_pgto: null },
        ],
      },
    });

    expect(parseOliveiraTrustHistoricoJson(json)).toEqual([
      { date: '15/04/2026', total: '7,04340359' },
      { date: '16/03/2026', total: '5,98177597' },
    ]);
  });

  it('retorna [] para JSON inválido ou payload vazio', () => {
    expect(parseOliveiraTrustHistoricoJson('not json')).toEqual([]);
    expect(parseOliveiraTrustHistoricoJson('{}')).toEqual([]);
  });
});

describe('oliveiraTrustPaymentScheduleProvider.canHandle', () => {
  it('aceita URLs da Oliveira Trust', () => {
    expect(
      oliveiraTrustPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl:
          'https://www.oliveiratrust.com.br/investidor/ativos/historico-valores/56891',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(true);
  });

  it('rejeita hosts de outros providers', () => {
    expect(
      oliveiraTrustPaymentScheduleProvider.canHandle({
        fiduciaryAgentUrl: 'https://www.vortx.com.br/investidor/dcm',
        asset: { code: 'X', nickName: 'Teste' },
      }),
    ).toBe(false);
  });
});
