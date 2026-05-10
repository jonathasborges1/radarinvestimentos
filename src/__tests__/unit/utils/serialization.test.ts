import { describe, it, expect } from 'vitest';
import { serializeAssets, deserializeAssets } from '../../../utils/serialization';
import type { Asset } from '../../../types';

describe('serializeAssets', () => {
  it('should produce JSON with {"data": [...]} structure', () => {
    const assets: Asset[] = [
      {
        code: 1,
        nickName: 'CRA Test',
        maturityDate: '2025-12-01',
        fee: '10%',
        product: 'CRA',
        qualifiedInvestor: 'S',
        professionalInvestor: 'N',
        generalInvestor: 'N',
        indexers: 'CDI',
        incentive: 'S',
        ratingName: 'AAA',
        agencyName: 'Fitch',
        guaranteeFGC: false,
        redemptionType: 'No vencimento',
      },
    ];

    const result = serializeAssets(assets);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty('data');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].code).toBe(1);
    expect(parsed.data[0].nickName).toBe('CRA Test');
  });

  it('should use 2-space indentation', () => {
    const assets: Asset[] = [
      {
        code: 42,
        nickName: 'Test',
        maturityDate: null,
        fee: null,
        product: null,
        qualifiedInvestor: 'N',
        professionalInvestor: 'N',
        generalInvestor: 'S',
        indexers: null,
        incentive: 'N',
        ratingName: null,
        agencyName: null,
        guaranteeFGC: true,
        redemptionType: null,
      },
    ];

    const result = serializeAssets(assets);

    // 2-space indentation means lines start with "  " for first level
    expect(result).toContain('  "data"');
  });

  it('should serialize an empty array', () => {
    const result = serializeAssets([]);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({ data: [] });
  });

  it('should preserve custom fields', () => {
    const assets: Asset[] = [
      {
        code: 1,
        nickName: 'Test',
        maturityDate: null,
        fee: null,
        product: null,
        qualifiedInvestor: 'N',
        professionalInvestor: 'N',
        generalInvestor: 'S',
        indexers: null,
        incentive: 'N',
        ratingName: null,
        agencyName: null,
        guaranteeFGC: false,
        redemptionType: null,
        b3Code: 'B3TEST',
        fiduciaryAgentUrls: ['https://example.com', 'https://other.com'],
        notes: 'Some notes',
        favorite: true,
        tags: ['tag1', 'tag2'],
        trackingStatus: 'watching',
      },
    ];

    const result = serializeAssets(assets);
    const parsed = JSON.parse(result);

    expect(parsed.data[0].b3Code).toBe('B3TEST');
    expect(parsed.data[0].fiduciaryAgentUrls).toEqual(['https://example.com', 'https://other.com']);
    expect(parsed.data[0].notes).toBe('Some notes');
    expect(parsed.data[0].favorite).toBe(true);
    expect(parsed.data[0].tags).toEqual(['tag1', 'tag2']);
    expect(parsed.data[0].trackingStatus).toBe('watching');
  });

  it('should preserve extra/unknown fields not in the Asset type', () => {
    const assets = [
      {
        code: 1,
        nickName: 'Test',
        maturityDate: null,
        fee: null,
        product: null,
        qualifiedInvestor: 'N',
        professionalInvestor: 'N',
        generalInvestor: 'S',
        indexers: null,
        incentive: 'N',
        ratingName: null,
        agencyName: null,
        guaranteeFGC: false,
        redemptionType: null,
        unknownField: 'preserved',
        anotherExtra: 123,
      },
    ] as unknown as Asset[];

    const result = serializeAssets(assets);
    const parsed = JSON.parse(result);

    expect(parsed.data[0].unknownField).toBe('preserved');
    expect(parsed.data[0].anotherExtra).toBe(123);
  });
});

describe('deserializeAssets', () => {
  it('should parse valid JSON and return assets', () => {
    const json = JSON.stringify({
      data: [
        { code: 1, nickName: 'CRA Test', product: 'CRA', guaranteeFGC: false },
        { code: 2, nickName: 'CRI Test', product: 'CRI', guaranteeFGC: true },
      ],
    });

    const result = deserializeAssets(json);

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe(1);
    expect(result[0].nickName).toBe('CRA Test');
    expect(result[1].code).toBe(2);
  });

  it('should throw for invalid JSON syntax', () => {
    expect(() => deserializeAssets('not valid json')).toThrow(
      'O arquivo selecionado não é um JSON válido.'
    );
  });

  it('should throw when data property is missing', () => {
    const json = JSON.stringify({ items: [] });

    expect(() => deserializeAssets(json)).toThrow(
      "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
    );
  });

  it('should throw when data is not an array', () => {
    const json = JSON.stringify({ data: 'not an array' });

    expect(() => deserializeAssets(json)).toThrow(
      "Estrutura incompatível: a propriedade 'data' deve ser um array."
    );
  });

  it('should throw when an item is missing required fields', () => {
    const json = JSON.stringify({
      data: [{ nickName: 'Missing code' }],
    });

    expect(() => deserializeAssets(json)).toThrow(
      "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
    );
  });

  it('should accept an empty data array', () => {
    const json = JSON.stringify({ data: [] });
    const result = deserializeAssets(json);

    expect(result).toEqual([]);
  });

  it('should preserve extra/unknown fields during deserialization', () => {
    const json = JSON.stringify({
      data: [
        {
          code: 1,
          nickName: 'Test',
          unknownField: 'should be preserved',
          nestedExtra: { a: 1 },
        },
      ],
    });

    const result = deserializeAssets(json);

    expect((result[0] as Record<string, unknown>).unknownField).toBe('should be preserved');
    expect((result[0] as Record<string, unknown>).nestedExtra).toEqual({ a: 1 });
  });

  it('should round-trip: deserialize(serialize(assets)) === assets', () => {
    const assets: Asset[] = [
      {
        code: 42,
        nickName: 'Round Trip Test',
        maturityDate: '2026-06-15',
        fee: '12.5%',
        product: 'DEB',
        qualifiedInvestor: 'S',
        professionalInvestor: 'N',
        generalInvestor: 'N',
        indexers: 'IPCA',
        incentive: 'N',
        ratingName: 'AA+',
        agencyName: "Moody's",
        guaranteeFGC: true,
        redemptionType: 'Antecipado',
        b3Code: 'DEBX11',
        tags: ['renda-fixa', 'ipca'],
        trackingStatus: 'watching',
      },
    ];

    const serialized = serializeAssets(assets);
    const deserialized = deserializeAssets(serialized);

    expect(deserialized).toEqual(assets);
  });
});
