import { describe, it, expect } from 'vitest';
import { sortAssets } from '../../../utils/sorting';
import type { Asset, SortConfig } from '../../../types';

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    nickName: 'Test Asset',
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

describe('sortAssets', () => {
  describe('when column is null', () => {
    it('returns a copy of the array unchanged', () => {
      const assets = [
        createAsset({ nickName: 'B Asset', code: 2 }),
        createAsset({ nickName: 'A Asset', code: 1 }),
      ];
      const config: SortConfig = { column: null, direction: 'asc' };
      const result = sortAssets(assets, config);

      expect(result).toEqual(assets);
      expect(result).not.toBe(assets); // new array
    });
  });

  describe('does not mutate input', () => {
    it('returns a new array', () => {
      const assets = [
        createAsset({ nickName: 'B', code: 2 }),
        createAsset({ nickName: 'A', code: 1 }),
      ];
      const config: SortConfig = { column: 'nickName', direction: 'asc' };
      const result = sortAssets(assets, config);

      expect(result).not.toBe(assets);
      expect(assets[0].nickName).toBe('B');
    });
  });

  describe('sorting by nickName', () => {
    const assets = [
      createAsset({ nickName: 'Charlie', code: 3 }),
      createAsset({ nickName: 'Alpha', code: 1 }),
      createAsset({ nickName: 'Bravo', code: 2 }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'nickName', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('sorts descending', () => {
      const config: SortConfig = { column: 'nickName', direction: 'desc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    });
  });

  describe('sorting by product', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, product: 'DEB' }),
      createAsset({ nickName: 'B', code: 2, product: 'CRA' }),
      createAsset({ nickName: 'C', code: 3, product: 'CRI' }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'product', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.product)).toEqual(['CRA', 'CRI', 'DEB']);
    });

    it('sorts descending', () => {
      const config: SortConfig = { column: 'product', direction: 'desc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.product)).toEqual(['DEB', 'CRI', 'CRA']);
    });
  });

  describe('sorting by fee', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, fee: '19,550%' }),
      createAsset({ nickName: 'B', code: 2, fee: '8,250%' }),
      createAsset({ nickName: 'C', code: 3, fee: '12,000%' }),
    ];

    it('sorts ascending by parsed numeric value', () => {
      const config: SortConfig = { column: 'fee', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });

    it('sorts descending by parsed numeric value', () => {
      const config: SortConfig = { column: 'fee', direction: 'desc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['A', 'C', 'B']);
    });

    it('uses prefixedFeeValue when available', () => {
      const assetsWithPrefixed = [
        createAsset({ nickName: 'A', code: 1, fee: '5,000%', prefixedFeeValue: 20 }),
        createAsset({ nickName: 'B', code: 2, fee: '15,000%' }),
      ];
      const config: SortConfig = { column: 'fee', direction: 'asc' };
      const result = sortAssets(assetsWithPrefixed, config);
      // prefixedFeeValue=20 > parsed 15, so B comes first
      expect(result.map((a) => a.nickName)).toEqual(['B', 'A']);
    });
  });

  describe('sorting by maturityDate', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, maturityDate: '2027-06-15' }),
      createAsset({ nickName: 'B', code: 2, maturityDate: '2025-01-10' }),
      createAsset({ nickName: 'C', code: 3, maturityDate: '2026-03-20' }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'maturityDate', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });

    it('sorts descending', () => {
      const config: SortConfig = { column: 'maturityDate', direction: 'desc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['A', 'C', 'B']);
    });
  });

  describe('sorting by puMinValue', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, puMinValue: 1000 }),
      createAsset({ nickName: 'B', code: 2, puMinValue: 500 }),
      createAsset({ nickName: 'C', code: 3, puMinValue: 750 }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'puMinValue', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('sorting by quantityAvailable', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, quantityAvailable: 300 }),
      createAsset({ nickName: 'B', code: 2, quantityAvailable: 100 }),
      createAsset({ nickName: 'C', code: 3, quantityAvailable: 200 }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'quantityAvailable', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('sorting by riskScore', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, riskScore: 7 }),
      createAsset({ nickName: 'B', code: 2, riskScore: 3 }),
      createAsset({ nickName: 'C', code: 3, riskScore: 5 }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'riskScore', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('sorting by ratingName', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, ratingName: 'BBB' }),
      createAsset({ nickName: 'B', code: 2, ratingName: 'AA' }),
      createAsset({ nickName: 'C', code: 3, ratingName: 'AAA' }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'ratingName', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('sorting by code', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 300 }),
      createAsset({ nickName: 'B', code: 100 }),
      createAsset({ nickName: 'C', code: 200 }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'code', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('sorting by b3Code', () => {
    const assets = [
      createAsset({ nickName: 'A', code: 1, b3Code: 'ZZZ11' }),
      createAsset({ nickName: 'B', code: 2, b3Code: 'AAA11' }),
      createAsset({ nickName: 'C', code: 3, b3Code: 'MMM11' }),
    ];

    it('sorts ascending', () => {
      const config: SortConfig = { column: 'b3Code', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });
  });

  describe('null/undefined handling', () => {
    it('pushes null values to the end in ascending order', () => {
      const assets = [
        createAsset({ nickName: 'A', code: 1, riskScore: null }),
        createAsset({ nickName: 'B', code: 2, riskScore: 5 }),
        createAsset({ nickName: 'C', code: 3, riskScore: 3 }),
      ];
      const config: SortConfig = { column: 'riskScore', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['C', 'B', 'A']);
    });

    it('pushes null values to the end in descending order', () => {
      const assets = [
        createAsset({ nickName: 'A', code: 1, riskScore: null }),
        createAsset({ nickName: 'B', code: 2, riskScore: 5 }),
        createAsset({ nickName: 'C', code: 3, riskScore: 3 }),
      ];
      const config: SortConfig = { column: 'riskScore', direction: 'desc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['B', 'C', 'A']);
    });

    it('pushes undefined b3Code to the end', () => {
      const assets = [
        createAsset({ nickName: 'A', code: 1 }), // b3Code is undefined
        createAsset({ nickName: 'B', code: 2, b3Code: 'XYZ11' }),
        createAsset({ nickName: 'C', code: 3, b3Code: 'ABC11' }),
      ];
      const config: SortConfig = { column: 'b3Code', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['C', 'B', 'A']);
    });

    it('handles null fee values', () => {
      const assets = [
        createAsset({ nickName: 'A', code: 1, fee: null }),
        createAsset({ nickName: 'B', code: 2, fee: '10,000%' }),
        createAsset({ nickName: 'C', code: 3, fee: '5,000%' }),
      ];
      const config: SortConfig = { column: 'fee', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['C', 'B', 'A']);
    });

    it('handles null maturityDate', () => {
      const assets = [
        createAsset({ nickName: 'A', code: 1, maturityDate: null }),
        createAsset({ nickName: 'B', code: 2, maturityDate: '2025-06-15' }),
        createAsset({ nickName: 'C', code: 3, maturityDate: '2024-01-01' }),
      ];
      const config: SortConfig = { column: 'maturityDate', direction: 'asc' };
      const result = sortAssets(assets, config);
      expect(result.map((a) => a.nickName)).toEqual(['C', 'B', 'A']);
    });
  });

  describe('preserves set of elements', () => {
    it('sorted array has same length and same elements', () => {
      const assets = [
        createAsset({ nickName: 'C', code: 3 }),
        createAsset({ nickName: 'A', code: 1 }),
        createAsset({ nickName: 'B', code: 2 }),
      ];
      const config: SortConfig = { column: 'nickName', direction: 'asc' };
      const result = sortAssets(assets, config);

      expect(result).toHaveLength(assets.length);
      for (const asset of assets) {
        expect(result).toContainEqual(asset);
      }
    });
  });

  describe('empty array', () => {
    it('returns empty array', () => {
      const config: SortConfig = { column: 'nickName', direction: 'asc' };
      const result = sortAssets([], config);
      expect(result).toEqual([]);
    });
  });
});
