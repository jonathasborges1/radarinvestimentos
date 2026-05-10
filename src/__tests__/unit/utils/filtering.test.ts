import { describe, it, expect } from 'vitest';
import { searchAssets, filterAssets, extractFilterOptions } from '../../../utils/filtering';
import type { Asset, FilterState } from '../../../types';

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    nickName: 'CRA Test Asset',
    maturityDate: '2025-12-31',
    fee: '10,500%',
    product: 'CRA',
    qualifiedInvestor: 'S',
    professionalInvestor: 'N',
    generalInvestor: 'N',
    indexers: 'CDI',
    incentive: 'S',
    ratingName: 'AAA',
    agencyName: 'Fitch',
    guaranteeFGC: false,
    redemptionType: 'No Vencimento',
    code: 12345,
    ...overrides,
  };
}

function emptyFilters(): FilterState {
  return {
    search: '',
    product: [],
    indexer: [],
    rating: [],
    agency: [],
    interestFrequency: [],
    amortizationFrequency: [],
    qualifiedInvestor: null,
    professionalInvestor: null,
    generalInvestor: null,
    incentive: null,
    guaranteeFGC: null,
    maturityDateStart: null,
    maturityDateEnd: null,
    feeMin: null,
    feeMax: null,
    riskMin: null,
    riskMax: null,
  };
}

describe('searchAssets', () => {
  const assets: Asset[] = [
    createAsset({ nickName: 'CRA Agro Fund', code: 1001, product: 'CRA', b3Code: 'AGRO11' }),
    createAsset({ nickName: 'CRI Imobiliário', code: 1002, product: 'CRI', ratingName: 'AA+' }),
    createAsset({ nickName: 'Debênture XYZ', code: 1003, product: 'DEB', agencyName: "Moody's" }),
    createAsset({ nickName: 'LF Banco', code: 1004, product: 'LF', indexers: 'IPCA' }),
  ];

  it('returns all assets when query is empty', () => {
    expect(searchAssets(assets, '')).toEqual(assets);
    expect(searchAssets(assets, '   ')).toEqual(assets);
  });

  it('searches by nickName (case-insensitive)', () => {
    const result = searchAssets(assets, 'agro');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('CRA Agro Fund');
  });

  it('searches by product', () => {
    const result = searchAssets(assets, 'cri');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('CRI Imobiliário');
  });

  it('searches by code', () => {
    const result = searchAssets(assets, '1003');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Debênture XYZ');
  });

  it('searches by b3Code', () => {
    const result = searchAssets(assets, 'AGRO11');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('CRA Agro Fund');
  });

  it('searches by ratingName', () => {
    const result = searchAssets(assets, 'AA+');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('CRI Imobiliário');
  });

  it('searches by agencyName', () => {
    const result = searchAssets(assets, "moody");
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Debênture XYZ');
  });

  it('searches by indexers', () => {
    const result = searchAssets(assets, 'ipca');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('LF Banco');
  });

  it('returns empty array when no match', () => {
    const result = searchAssets(assets, 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('matches partial strings', () => {
    const result = searchAssets(assets, 'deb');
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Debênture XYZ');
  });
});

describe('filterAssets', () => {
  const assets: Asset[] = [
    createAsset({
      nickName: 'Asset A',
      code: 1,
      product: 'CRA',
      indexers: 'CDI',
      ratingName: 'AAA',
      agencyName: 'Fitch',
      qualifiedInvestor: 'S',
      professionalInvestor: 'N',
      generalInvestor: 'N',
      incentive: 'S',
      guaranteeFGC: true,
      maturityDate: '2025-06-15',
      fee: '10,500%',
      riskScore: 3,
    }),
    createAsset({
      nickName: 'Asset B',
      code: 2,
      product: 'CRI',
      indexers: 'IPCA',
      ratingName: 'AA',
      agencyName: "Moody's",
      qualifiedInvestor: 'N',
      professionalInvestor: 'S',
      generalInvestor: 'S',
      incentive: 'N',
      guaranteeFGC: false,
      maturityDate: '2026-03-20',
      fee: '8,250%',
      riskScore: 5,
    }),
    createAsset({
      nickName: 'Asset C',
      code: 3,
      product: 'DEB',
      indexers: 'CDI',
      ratingName: 'BBB',
      agencyName: 'S&P',
      qualifiedInvestor: 'S',
      professionalInvestor: 'S',
      generalInvestor: 'N',
      incentive: 'S',
      guaranteeFGC: false,
      maturityDate: '2027-01-10',
      fee: '12,000%',
      riskScore: 7,
    }),
  ];

  it('returns all assets when no filters are active', () => {
    const result = filterAssets(assets, emptyFilters());
    expect(result).toHaveLength(3);
  });

  // Selection filters
  it('filters by product', () => {
    const filters = { ...emptyFilters(), product: ['CRA'] };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('filters by multiple products', () => {
    const filters = { ...emptyFilters(), product: ['CRA', 'CRI'] };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by indexer', () => {
    const filters = { ...emptyFilters(), indexer: ['CDI'] };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by rating', () => {
    const filters = { ...emptyFilters(), rating: ['AAA'] };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('filters by agency', () => {
    const filters = { ...emptyFilters(), agency: ['Fitch'] };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  // Boolean filters
  it('filters by qualifiedInvestor = true (matches "S")', () => {
    const filters = { ...emptyFilters(), qualifiedInvestor: true as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.qualifiedInvestor === 'S')).toBe(true);
  });

  it('filters by qualifiedInvestor = false (matches "N")', () => {
    const filters = { ...emptyFilters(), qualifiedInvestor: false as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].qualifiedInvestor).toBe('N');
  });

  it('filters by professionalInvestor = true', () => {
    const filters = { ...emptyFilters(), professionalInvestor: true as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by generalInvestor = true', () => {
    const filters = { ...emptyFilters(), generalInvestor: true as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset B');
  });

  it('filters by incentive = true', () => {
    const filters = { ...emptyFilters(), incentive: true as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by guaranteeFGC = true (boolean field)', () => {
    const filters = { ...emptyFilters(), guaranteeFGC: true as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('filters by guaranteeFGC = false', () => {
    const filters = { ...emptyFilters(), guaranteeFGC: false as boolean | null };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  // Date range filters
  it('filters by maturityDateStart', () => {
    const filters = { ...emptyFilters(), maturityDateStart: '2026-01-01' };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by maturityDateEnd', () => {
    const filters = { ...emptyFilters(), maturityDateEnd: '2026-01-01' };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('filters by date range (start and end)', () => {
    const filters = {
      ...emptyFilters(),
      maturityDateStart: '2025-01-01',
      maturityDateEnd: '2026-12-31',
    };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('excludes assets with null maturityDate when date filter is active', () => {
    const assetsWithNull = [...assets, createAsset({ nickName: 'No Date', code: 4, maturityDate: null })];
    const filters = { ...emptyFilters(), maturityDateStart: '2025-01-01' };
    const result = filterAssets(assetsWithNull, filters);
    expect(result.find((a) => a.nickName === 'No Date')).toBeUndefined();
  });

  // Fee range filters
  it('filters by feeMin', () => {
    const filters = { ...emptyFilters(), feeMin: 10 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2); // 10.5% and 12%
  });

  it('filters by feeMax', () => {
    const filters = { ...emptyFilters(), feeMax: 9 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset B');
  });

  it('filters by fee range', () => {
    const filters = { ...emptyFilters(), feeMin: 9, feeMax: 11 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('uses prefixedFeeValue when available', () => {
    const assetsWithPrefixed = [
      createAsset({ nickName: 'Prefixed', code: 10, fee: null, prefixedFeeValue: 15.5, riskScore: 1 }),
    ];
    const filters = { ...emptyFilters(), feeMin: 15, feeMax: 16 };
    const result = filterAssets(assetsWithPrefixed, filters);
    expect(result).toHaveLength(1);
  });

  it('excludes assets with null fee when fee filter is active', () => {
    const assetsWithNull = [...assets, createAsset({ nickName: 'No Fee', code: 5, fee: null })];
    const filters = { ...emptyFilters(), feeMin: 5 };
    const result = filterAssets(assetsWithNull, filters);
    expect(result.find((a) => a.nickName === 'No Fee')).toBeUndefined();
  });

  // Risk range filters
  it('filters by riskMin', () => {
    const filters = { ...emptyFilters(), riskMin: 5 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by riskMax', () => {
    const filters = { ...emptyFilters(), riskMax: 4 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset A');
  });

  it('filters by risk range', () => {
    const filters = { ...emptyFilters(), riskMin: 4, riskMax: 6 };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset B');
  });

  it('excludes assets with null riskScore when risk filter is active', () => {
    const assetsWithNull = [...assets, createAsset({ nickName: 'No Risk', code: 6, riskScore: null })];
    const filters = { ...emptyFilters(), riskMin: 1 };
    const result = filterAssets(assetsWithNull, filters);
    expect(result.find((a) => a.nickName === 'No Risk')).toBeUndefined();
  });

  // Combined filters (AND logic)
  it('applies AND logic between multiple filters', () => {
    const filters = {
      ...emptyFilters(),
      product: ['CRA', 'DEB'],
      incentive: true as boolean | null,
      riskMin: 5,
    };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(1);
    expect(result[0].nickName).toBe('Asset C');
  });

  it('returns empty when filters are contradictory', () => {
    const filters = {
      ...emptyFilters(),
      product: ['CRA'],
      qualifiedInvestor: false as boolean | null, // Asset A has 'S'
    };
    const result = filterAssets(assets, filters);
    expect(result).toHaveLength(0);
  });
});

describe('extractFilterOptions', () => {
  const assets: Asset[] = [
    createAsset({ product: 'CRA', indexers: 'CDI', ratingName: 'AAA', agencyName: 'Fitch' }),
    createAsset({ product: 'CRI', indexers: 'IPCA', ratingName: 'AA', agencyName: "Moody's" }),
    createAsset({ product: 'CRA', indexers: 'CDI', ratingName: 'AAA', agencyName: 'Fitch' }),
    createAsset({ product: 'DEB', indexers: null, ratingName: null, agencyName: null }),
  ];

  it('extracts unique sorted products', () => {
    const options = extractFilterOptions(assets);
    expect(options.products).toEqual(['CRA', 'CRI', 'DEB']);
  });

  it('extracts unique sorted indexers (excluding null)', () => {
    const options = extractFilterOptions(assets);
    expect(options.indexers).toEqual(['CDI', 'IPCA']);
  });

  it('extracts unique sorted ratings (excluding null)', () => {
    const options = extractFilterOptions(assets);
    expect(options.ratings).toEqual(['AA', 'AAA']);
  });

  it('extracts unique sorted agencies (excluding null)', () => {
    const options = extractFilterOptions(assets);
    expect(options.agencies).toEqual(['Fitch', "Moody's"]);
  });

  it('returns empty arrays for empty asset list', () => {
    const options = extractFilterOptions([]);
    expect(options.products).toEqual([]);
    expect(options.indexers).toEqual([]);
    expect(options.ratings).toEqual([]);
    expect(options.agencies).toEqual([]);
  });
});
