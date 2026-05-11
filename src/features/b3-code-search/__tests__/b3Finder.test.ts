import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanedAssetName,
  detectProductCode,
  extractStrongTerms,
  extractMaturityMonthName,
  extractMaturityMonthYear,
  normalizeAssetName,
  normalizeSearchText,
  parseFeePercent,
  stripAccents,
  tokenize,
} from '../normalize';
import {
  CONFIDENCE_THRESHOLDS,
  extractB3Candidates,
  scoreHit,
} from '../scoring';
import {
  buildSearchQueries,
  findB3Code,
  stripHtmlText,
} from '../service';
import {
  buildDuckDuckGoUrl,
  parseDuckDuckGoHtml,
  unwrapDuckUrl,
} from '../providers/duckduckgoSearchProvider';
import {
  buildBingUrl,
  parseBingHtml,
} from '../providers/bingSearchProvider';
import type { B3SearchProvider, SearchHit } from '../index';

const SAMPLE_INPUT = {
  nickName: 'CRA FS BIO - JUL/2030',
  maturityDate: '2030-07-15T00:00:00',
  fee: '19,550%',
  product: 'CRA',
  indexers: 'Pré-fixado',
  ratingName: 'AA-',
  agencyName: 'Fitch',
  descriptionInterestrates: 'Mensal a partir de: 15/02/2024',
} as const;

/* ------------------------------------------------------------------ */
/*  normalize.ts                                                        */
/* ------------------------------------------------------------------ */

describe('stripAccents', () => {
  it('remove acentos preservando letras-base', () => {
    expect(stripAccents('Pré-fixado')).toBe('Pre-fixado');
    expect(stripAccents('São Paulo')).toBe('Sao Paulo');
  });
});

describe('tokenize', () => {
  it('descarta stopwords e tokens unitários', () => {
    expect(tokenize('CRA FS BIO de a o')).toEqual(['CRA', 'FS', 'BIO']);
  });
  it('coloca tudo em UPPER e remove pontuação', () => {
    expect(tokenize('cra fs-bio')).toEqual(['CRA', 'FS', 'BIO']);
  });
});

describe('normalizeSearchText / normalizeAssetName / extractStrongTerms', () => {
  it('normaliza acentos, hifens, caracteres especiais e espacos', () => {
    expect(normalizeSearchText('CRA  Réde-Sim!!  Pré-fixado')).toBe('CRA REDE SIM PRE FIXADO');
  });

  it('remove mes/ano e ano isolado do nome do ativo', () => {
    expect(normalizeAssetName('CRA REDE SIM - FEV/2030')).toBe('CRA REDE SIM');
    expect(normalizeAssetName('CRA REDE SIM 2030')).toBe('CRA REDE SIM');
  });

  it('extrai termos fortes do ativo', () => {
    expect(extractStrongTerms({
      nickName: 'CRA REDE SIM - FEV/2030',
      product: 'CRA',
      maturityDate: '2030-02-18T00:00:00',
    })).toEqual(['CRA', 'REDE', 'SIM', '2030']);
  });
});

describe('extractMaturityMonthYear / MonthName', () => {
  it('numérico', () => {
    expect(extractMaturityMonthYear('2030-07-15T00:00:00')).toBe('07/2030');
  });
  it('nome do mês', () => {
    expect(extractMaturityMonthName('2030-07-15')).toBe('JUL/2030');
  });
  it('null para entradas inválidas', () => {
    expect(extractMaturityMonthYear(null)).toBeNull();
    expect(extractMaturityMonthName('xx')).toBeNull();
  });
});

describe('parseFeePercent', () => {
  it('19,550% → 19.55', () => {
    expect(parseFeePercent('19,550%')).toBeCloseTo(19.55, 4);
  });
  it('null para entrada vazia', () => {
    expect(parseFeePercent(null)).toBeNull();
    expect(parseFeePercent('abc')).toBeNull();
  });
});

describe('cleanedAssetName', () => {
  it('remove sufixo de mês/ano e hífen', () => {
    expect(cleanedAssetName(SAMPLE_INPUT)).toBe('CRA FS BIO');
  });
  it('remove sufixo numérico', () => {
    expect(cleanedAssetName({ nickName: 'CRA AGRO - 07/2030' })).toBe('CRA AGRO');
  });
});

describe('detectProductCode', () => {
  it.each([
    ['CRA', 'CRA'],
    ['CRI', 'CRI'],
    ['Debênture', 'DEB'],
    ['cra', 'CRA'],
  ])('"%s" → %s', (product, expected) => {
    expect(detectProductCode({ nickName: 'x', product })).toBe(expected);
  });

  it('null para produtos não reconhecidos', () => {
    expect(detectProductCode({ nickName: 'x', product: 'LCI' })).toBeNull();
    expect(detectProductCode({ nickName: 'x' })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  scoring.ts                                                          */
/* ------------------------------------------------------------------ */

describe('extractB3Candidates', () => {
  it('captura código CRA com 8 dígitos numéricos', () => {
    expect(extractB3Candidates('Operação CRA02500001 disponível', 'CRA')).toEqual(['CRA02500001']);
  });
  it('captura código CRA com mistura alfanumérica', () => {
    expect(extractB3Candidates('Resgate CRA025008SY')).toEqual(['CRA025008SY']);
  });
  it('captura código IF sem prefixo em CRI/CRA', () => {
    expect(extractB3Candidates('https://app.opea.com.br/pt/emissoes/24E2531061', 'CRI')).toEqual(['24E2531061']);
  });
  it('captura ticker de FII (4 letras + 11)', () => {
    expect(extractB3Candidates('Ativo CPTS11 negociado').sort()).toEqual(['CPTS11']);
  });
  it('filtra debêntures quando o produto é CRA', () => {
    expect(extractB3Candidates('CRA02500001 e BRDT13', 'CRA')).toEqual(['CRA02500001']);
  });
  it('lista vazia quando nada casa', () => {
    expect(extractB3Candidates('texto qualquer sem códigos')).toEqual([]);
  });

  it('rejeita palavras portuguesas que começam com CRA/CRI', () => {
    // Regressão real: usuário viu "CRIPTOMOEDAS" sendo retornado como
    // candidato porque o regex antigo aceitava 8-12 letras após o prefixo.
    expect(extractB3Candidates('texto sobre CRIPTOMOEDAS hoje', 'CRI')).toEqual([]);
    expect(extractB3Candidates('CRIPTOGRAFIA forte', 'CRI')).toEqual([]);
    expect(extractB3Candidates('artigo sobre CRIATIVIDADE', 'CRA')).toEqual([]);
    expect(extractB3Candidates('Reportagem da CRACOLANDIA', 'CRA')).toEqual([]);
    expect(extractB3Candidates('CRIMINALMENTE responsável', 'CRI')).toEqual([]);
  });

  it('exige dígito imediatamente após o prefixo CRA/CRI', () => {
    expect(extractB3Candidates('CRAABCDEFGH', 'CRA')).toEqual([]);
    expect(extractB3Candidates('CRA02500001', 'CRA')).toEqual(['CRA02500001']);
  });
});

describe('scoreHit', () => {
  const baseHit = (over: Partial<SearchHit> = {}): SearchHit => ({
    title: '',
    snippet: '',
    url: '',
    candidates: [],
    ...over,
  });

  it('score alto quando todos os sinais objetivos casam', () => {
    const hit = baseHit({
      title: 'CRA FS BIO JUL/2030 — Detalhes do ativo',
      snippet: 'Taxa pré-fixada ao ano. Rating AA- pela Fitch. Pagamento de juros: Mensal.',
      url: 'https://www.b3.com.br/cra/CRA02500001',
      candidates: ['CRA02500001'],
    });
    const { total, parts } = scoreHit(SAMPLE_INPUT, hit);
    expect(parts.nickName).toBe(1);
    expect(parts.product).toBe(1);
    expect(parts.maturity).toBe(1);
    expect(parts.indexer).toBe(1);
    expect(parts.interestFrequency).toBe(1);
    expect(parts.maturityMismatch).toBe(0);
    expect(parts.indexerMismatch).toBe(0);
    expect(parts.fee).toBeUndefined(); // taxa não entra no score
    expect(total).toBe(100); // clamped from 105
  });

  it('combinação objetiva nome+tipo+vencimento+indexador atinge FOUND', () => {
    const hit = baseHit({
      title: 'CRA FS BIO JUL/2030',
      snippet: 'Pré-fixado',
      url: 'https://exemplo.com/CRA02500001',
    });
    const { total } = scoreHit(SAMPLE_INPUT, hit);
    expect(total).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.found);
  });

  it('score baixo quando só o nome bate parcialmente', () => {
    const hit = baseHit({
      title: 'BIO Operações',
      snippet: 'Outra operação totalmente diferente.',
      url: 'https://exemplo.com/x',
    });
    const { total } = scoreHit(SAMPLE_INPUT, hit);
    expect(total).toBeLessThan(CONFIDENCE_THRESHOLDS.lowConfidence);
  });

  it('reconhece ano em fallback de maturidade', () => {
    const hit = baseHit({ title: 'CRA FS BIO', snippet: 'vencimento em 2030', url: 'x' });
    expect(scoreHit(SAMPLE_INPUT, hit).parts.maturity).toBe(0.5);
  });

  it('marca divergência quando a fonte informa outro mês/ano de vencimento', () => {
    const hit = baseHit({
      title: 'CRA FS BIO',
      snippet: 'Data de vencimento 15/05/2029.',
      url: 'https://example.com/CRA022004SD',
    });
    const { parts } = scoreHit(SAMPLE_INPUT, hit);
    expect(parts.maturity).toBe(0);
    expect(parts.maturityMismatch).toBe(1);
  });

  it('penaliza divergencia de indexador', () => {
    const hit = baseHit({
      title: 'CRA FS BIO JUL/2030',
      snippet: 'IPCA + 7,3913%.',
      url: 'https://example.com/CRA02500001',
    });
    const { total, parts, rejections } = scoreHit(SAMPLE_INPUT, hit);
    expect(parts.indexerMismatch).toBe(1);
    expect(total).toBeLessThan(CONFIDENCE_THRESHOLDS.found);
    expect(rejections.join(' ')).toMatch(/indexador/i);
  });

  it('penaliza divergencia de produto', () => {
    const hit = baseHit({
      title: 'CRI FS BIO JUL/2030',
      snippet: 'PrÃ©-fixado.',
      url: 'https://example.com/CRI02500001',
    });
    const { total, parts, rejections } = scoreHit(SAMPLE_INPUT, hit);
    expect(parts.productMismatch).toBe(1);
    expect(total).toBeLessThan(CONFIDENCE_THRESHOLDS.found);
    expect(rejections.join(' ')).toMatch(/produto/i);
  });
});

/* ------------------------------------------------------------------ */
/*  buildSearchQueries                                                  */
/* ------------------------------------------------------------------ */

describe('buildSearchQueries', () => {
  it('gera queries progressivas únicas privilegiando sinais objetivos', () => {
    const queries = buildSearchQueries(SAMPLE_INPUT);
    expect(queries.length).toBeGreaterThan(0);
    expect(new Set(queries).size).toBe(queries.length);
    // Emissor puro deve ser a primeira query (mais importante para buscadores diretos)
    expect(queries[0]).toBe('FS BIO');
    // Deve conter variantes com vencimento
    expect(queries.some(q => q.includes('JUL/2030'))).toBe(true);
    expect(queries.some(q => q.includes('Pré-fixado'))).toBe(true);
    expect(queries.some(q => q.endsWith('2030'))).toBe(true);
    expect(queries.some(q => q === 'CRA FS BIO')).toBe(true);
    expect(queries.some(q => q.includes('codigo B3'))).toBe(true);
    expect(queries.some(q => q.includes('termo de securitizacao'))).toBe(true);
  });

  it('não inclui a taxa em nenhuma query', () => {
    const queries = buildSearchQueries(SAMPLE_INPUT);
    expect(queries.every(q => !q.includes('19,'))).toBe(true);
    expect(queries.every(q => !q.includes('%'))).toBe(true);
  });

  it('inclui variante sem o nome quando temos tipo+vencimento+indexador', () => {
    const queries = buildSearchQueries(SAMPLE_INPUT);
    expect(queries.some(q => q === 'CRA JUL/2030 Pré-fixado')).toBe(true);
  });

  it('funciona mesmo com campos opcionais ausentes', () => {
    const queries = buildSearchQueries({ nickName: 'CRA SOMENTE NOME' });
    // Deve conter o nome completo como primeira query
    expect(queries).toContain('CRA SOMENTE NOME');
    // Pode ter queries extras (CETIP etc.) mas o nome deve estar presente
    expect(queries.length).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  duckduckgoSearchProvider                                            */
/* ------------------------------------------------------------------ */

describe('buildDuckDuckGoUrl', () => {
  it('codifica espaços e caracteres especiais', () => {
    expect(buildDuckDuckGoUrl('CRA FS BIO')).toContain('q=CRA%20FS%20BIO');
    expect(buildDuckDuckGoUrl('a&b')).toContain('q=a%26b');
  });
});

describe('unwrapDuckUrl', () => {
  it('decodifica wrapper /l/?uddg=…', () => {
    const wrapped = '//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.b3.com.br%2Fcra%2FX&rut=abc';
    expect(unwrapDuckUrl(wrapped)).toBe('https://www.b3.com.br/cra/X');
  });
  it('passa URL direta intacta', () => {
    expect(unwrapDuckUrl('https://example.com/a')).toBe('https://example.com/a');
  });
});

describe('buildBingUrl', () => {
  it('codifica espaços e mantém locale BR', () => {
    const url = buildBingUrl('CRA FS BIO');
    expect(url).toContain('q=CRA%20FS%20BIO');
    expect(url).toContain('cc=BR');
  });
});

describe('parseBingHtml', () => {
  const SAMPLE = `
<!doctype html>
<html><body>
<ol id="b_results">
  <li class="b_algo">
    <h2><a href="https://www.b3.com.br/cra/CRA02500001">B3 — CRA FS BIO JUL/2030</a></h2>
    <div class="b_caption"><p>Pré-fixada AA- Fitch.</p></div>
  </li>
  <li class="b_ad">
    <h2><a href="https://patrocinador.example/x">Patrocinado</a></h2>
    <p>Ignorar este resultado.</p>
  </li>
</ol>
</body></html>`;

  it('extrai resultados orgânicos e ignora patrocinados', () => {
    const hits = parseBingHtml(SAMPLE);
    expect(hits.length).toBe(1);
    expect(hits[0].url).toBe('https://www.b3.com.br/cra/CRA02500001');
    expect(hits[0].candidates).toContain('CRA02500001');
  });

  it('lista vazia para HTML sem resultados', () => {
    expect(parseBingHtml('<html><body></body></html>')).toEqual([]);
  });
});

describe('stripHtmlText', () => {
  it('remove tags, scripts e styles', () => {
    const html = '<html><head><style>x{color:red}</style></head><body><script>foo()</script><p>Olá <b>mundo</b></p></body></html>';
    expect(stripHtmlText(html)).toBe('Olá mundo');
  });

  it('limita o tamanho do texto', () => {
    const long = '<p>' + 'a'.repeat(200_000) + '</p>';
    expect(stripHtmlText(long, 1000).length).toBe(1000);
  });
});

describe('parseDuckDuckGoHtml', () => {
  const SAMPLE_HTML = `
<!doctype html>
<html><body>
<div class="result results_links">
  <h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.b3.com.br%2Fcra%2FCRA02500001">B3 — CRA FS BIO JUL/2030</a></h2>
  <a class="result__snippet">Taxa 19,55% pré-fixada. Rating AA- Fitch.</a>
</div>
<div class="result">
  <h2><a class="result__a" href="https://example.com/x">Resultado sem código</a></h2>
  <span class="result__snippet">Texto irrelevante.</span>
</div>
</body></html>`;

  it('extrai hits e desempacota wrapper de URL', () => {
    const hits = parseDuckDuckGoHtml(SAMPLE_HTML);
    expect(hits.length).toBe(2);
    expect(hits[0].url).toBe('https://www.b3.com.br/cra/CRA02500001');
    expect(hits[0].title).toContain('CRA FS BIO');
    expect(hits[0].candidates).toContain('CRA02500001');
    expect(hits[1].candidates).toEqual([]);
  });

  it('lista vazia para HTML sem resultados', () => {
    expect(parseDuckDuckGoHtml('<html><body></body></html>')).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  findB3Code (com providers fake — exercita orquestrador end-to-end)  */
/* ------------------------------------------------------------------ */

const localhostBefore = window.location.hostname;

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname: 'localhost' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname: localhostBefore },
  });
  vi.restoreAllMocks();
});

function fakeProvider(name: string, hits: SearchHit[]): B3SearchProvider {
  return {
    name,
    search: vi.fn().mockResolvedValue(hits),
  };
}

describe('findB3Code', () => {
  it('retorna FOUND quando o melhor candidato passa do limiar', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO JUL/2030 — Operação',
        snippet: 'Pré-fixado, 19,55%, AA- Fitch.',
        url: 'https://www.b3.com.br/cra/CRA02500001',
        candidates: ['CRA02500001'],
      },
    ]);

    const r = await findB3Code(SAMPLE_INPUT, { providers: [provider], maxQueriesPerProvider: 1 });
    expect(r.success).toBe(true);
    expect(r.status).toBe('FOUND');
    expect(r.b3Code).toBe('CRA02500001');
    expect(r.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.found);
    expect(r.sourceUrl).toContain('b3.com.br');
    expect(r.logs.length).toBeGreaterThan(0);
  });

  it('emite logs via callback durante a busca', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO JUL/2030 — Operação',
        snippet: 'Pré-fixado, AA- Fitch.',
        url: 'https://www.b3.com.br/cra/CRA02500001',
        candidates: ['CRA02500001'],
      },
    ]);
    const onLog = vi.fn();

    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      onLog,
    });

    expect(r.status).toBe('FOUND');
    expect(onLog).toHaveBeenCalled();
    expect(onLog.mock.calls.map(([line]) => line)).toEqual(r.logs);
  });

  it('usa URL de agente fiduciário como fonte direta antes da busca web', async () => {
    const provider = fakeProvider('fake', []);
    const r = await findB3Code(
      {
        ...SAMPLE_INPUT,
        fiduciaryAgentUrls: ['https://app.opea.com.br/pt/emissoes/24E2531061'],
      },
      { providers: [provider], maxQueriesPerProvider: 1 },
    );

    expect(provider.search).not.toHaveBeenCalled();
    expect(r.success).toBe(true);
    expect(r.status).toBe('FOUND');
    expect(r.b3Code).toBe('24E2531061');
    expect(r.sourceUrl).toContain('opea.com.br');
  });

  it('descarta candidato com mesmo nome mas vencimento explicitamente divergente', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO — CRA022004SD',
        snippet: 'IPCA + 7,3913%. Rating AA- Fitch. Data de vencimento 15/05/2029.',
        url: 'https://example.com/CRA022004SD',
        candidates: ['CRA022004SD'],
      },
    ]);

    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      deepHarvest: false,
    });

    expect(r.success).toBe(false);
    expect(r.status).toBe('NOT_FOUND');
    expect(r.b3Code).toBeUndefined();
  });

  it('não promove para FOUND quando apenas o ano do vencimento bate', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO vencimento em 2030',
        snippet: 'Pré-fixado, Rating AA- Fitch.',
        url: 'https://example.com/CRA02500001',
        candidates: ['CRA02500001'],
      },
    ]);

    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      deepHarvest: false,
    });

    expect(r.success).toBe(false);
    expect(r.status).toBe('LOW_CONFIDENCE');
    expect(r.b3Code).toBe('CRA02500001');
    expect(r.comparedData?.maturity).toBe(0.5);
  });

  it('retorna LOW_CONFIDENCE quando apenas o nickName e produto casam sem vencimento', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO',
        snippet: 'sem outros detalhes',
        url: 'https://example.com/CRA02500001',
        candidates: ['CRA02500001'],
      },
    ]);
    const r = await findB3Code(SAMPLE_INPUT, { providers: [provider], maxQueriesPerProvider: 1 });
    // Com nome + produto mas sem vencimento, score = 50 → LOW_CONFIDENCE
    expect(r.status).toBe('LOW_CONFIDENCE');
    expect(r.b3Code).toBe('CRA02500001');
    expect(r.success).toBe(false); // não é FOUND, precisa validação manual
  });

  it('retorna NOT_FOUND quando nenhum hit traz códigos', async () => {
    const provider = fakeProvider('fake', [
      { title: 'irrelevante', snippet: 'nada útil', url: 'https://x.com', candidates: [] },
    ]);
    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      deepHarvest: false,
    });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.success).toBe(false);
    expect(r.b3Code).toBeUndefined();
  });

  it('deep harvest extrai código do corpo da página quando o snippet não tem', async () => {
    // Hit com nome+vencimento batendo (score alto sem código no snippet).
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO JUL/2030 — Página oficial',
        snippet: 'Pré-fixado',
        url: 'https://example.com/cra-fs-bio',
        candidates: [],
      },
    ]);
    const fetchPage = vi.fn().mockResolvedValue(
      '<html><body><h1>CRA FS BIO</h1><p>Código IF: <strong>CRA02500001</strong> Vencimento JUL/2030 Pré-fixado AA- Fitch</p></body></html>',
    );
    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      deepHarvest: true,
      fetchPage,
    });
    expect(fetchPage).toHaveBeenCalledWith('https://example.com/cra-fs-bio');
    expect(r.b3Code).toBe('CRA02500001');
    expect(r.status).toBe('FOUND');
    expect(r.logs.some(l => l.includes('[harvest]'))).toBe(true);
  });

  it('deep harvest desligado quando deepHarvest=false', async () => {
    const provider = fakeProvider('fake', [
      {
        title: 'CRA FS BIO JUL/2030',
        snippet: 'Pré-fixado',
        url: 'https://example.com/cra-fs-bio',
        candidates: [],
      },
    ]);
    const fetchPage = vi.fn();
    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [provider],
      maxQueriesPerProvider: 1,
      deepHarvest: false,
      fetchPage,
    });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(r.status).toBe('NOT_FOUND');
  });

  it('detecta proxy off quando todos os providers falham', async () => {
    const failing: B3SearchProvider = {
      name: 'a',
      search: vi.fn().mockRejectedValue(new Error('Proxy local indisponível.')),
    };
    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [failing],
      maxQueriesPerProvider: 1,
      deepHarvest: false,
    });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.logs.some(l => /TODOS os providers falharam/i.test(l))).toBe(true);
    expect(r.logs.some(l => /node scripts\/proxy-scraper/i.test(l))).toBe(true);
  });

  it('continua mesmo se um provider lança erro', async () => {
    const failing: B3SearchProvider = {
      name: 'broken',
      search: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const ok = fakeProvider('ok', [
      {
        title: 'CRA FS BIO JUL/2030 — Pré-fixado 19,55% AA- Fitch',
        snippet: '',
        url: 'https://www.b3.com.br/CRA02500001',
        candidates: ['CRA02500001'],
      },
    ]);
    const r = await findB3Code(SAMPLE_INPUT, {
      providers: [failing, ok],
      maxQueriesPerProvider: 1,
    });
    expect(r.status).toBe('FOUND');
    expect(r.logs.some(l => l.includes('erro'))).toBe(true);
  });

  it('em ambiente não-localhost retorna NOT_FOUND com log explicativo', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, hostname: 'example.com' },
    });
    const r = await findB3Code(SAMPLE_INPUT, { providers: [], maxQueriesPerProvider: 1 });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.logs.join(' ')).toMatch(/localhost/i);
  });
});
