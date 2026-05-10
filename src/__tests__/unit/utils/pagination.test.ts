import { describe, it, expect } from 'vitest';
import { calculatePageInfo, paginateAssets } from '../../../utils/pagination';
import type { Asset } from '../../../types';

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

function createAssets(count: number): Asset[] {
  return Array.from({ length: count }, (_, i) =>
    createAsset({ nickName: `Asset ${i + 1}`, code: i + 1 })
  );
}

describe('calculatePageInfo', () => {
  describe('with numeric itemsPerPage', () => {
    it('calculates first page correctly', () => {
      const result = calculatePageInfo(100, 1, 25);
      expect(result).toEqual({ start: 1, end: 25, totalPages: 4 });
    });

    it('calculates middle page correctly', () => {
      const result = calculatePageInfo(100, 2, 25);
      expect(result).toEqual({ start: 26, end: 50, totalPages: 4 });
    });

    it('calculates last page correctly (partial)', () => {
      const result = calculatePageInfo(30, 2, 25);
      expect(result).toEqual({ start: 26, end: 30, totalPages: 2 });
    });

    it('calculates last page correctly (full)', () => {
      const result = calculatePageInfo(50, 2, 25);
      expect(result).toEqual({ start: 26, end: 50, totalPages: 2 });
    });

    it('handles single page', () => {
      const result = calculatePageInfo(10, 1, 25);
      expect(result).toEqual({ start: 1, end: 10, totalPages: 1 });
    });

    it('clamps page to valid range when too high', () => {
      const result = calculatePageInfo(50, 10, 25);
      // Should clamp to last page (page 2)
      expect(result).toEqual({ start: 26, end: 50, totalPages: 2 });
    });

    it('clamps page to 1 when too low', () => {
      const result = calculatePageInfo(50, 0, 25);
      expect(result).toEqual({ start: 1, end: 25, totalPages: 2 });
    });
  });

  describe('with itemsPerPage = "all"', () => {
    it('returns all items in a single page', () => {
      const result = calculatePageInfo(541, 1, 'all');
      expect(result).toEqual({ start: 1, end: 541, totalPages: 1 });
    });

    it('works with small datasets', () => {
      const result = calculatePageInfo(5, 1, 'all');
      expect(result).toEqual({ start: 1, end: 5, totalPages: 1 });
    });
  });

  describe('with zero items', () => {
    it('returns zeros', () => {
      const result = calculatePageInfo(0, 1, 25);
      expect(result).toEqual({ start: 0, end: 0, totalPages: 0 });
    });

    it('returns zeros with "all"', () => {
      const result = calculatePageInfo(0, 1, 'all');
      expect(result).toEqual({ start: 0, end: 0, totalPages: 0 });
    });
  });

  describe('with different page sizes', () => {
    it('works with 10 items per page', () => {
      const result = calculatePageInfo(55, 3, 10);
      expect(result).toEqual({ start: 21, end: 30, totalPages: 6 });
    });

    it('works with 50 items per page', () => {
      const result = calculatePageInfo(120, 3, 50);
      expect(result).toEqual({ start: 101, end: 120, totalPages: 3 });
    });

    it('works with 100 items per page', () => {
      const result = calculatePageInfo(250, 2, 100);
      expect(result).toEqual({ start: 101, end: 200, totalPages: 3 });
    });
  });
});

describe('paginateAssets', () => {
  const assets = createAssets(55);

  describe('with numeric itemsPerPage', () => {
    it('returns first page slice', () => {
      const result = paginateAssets(assets, 1, 10);
      expect(result).toHaveLength(10);
      expect(result[0].nickName).toBe('Asset 1');
      expect(result[9].nickName).toBe('Asset 10');
    });

    it('returns middle page slice', () => {
      const result = paginateAssets(assets, 3, 10);
      expect(result).toHaveLength(10);
      expect(result[0].nickName).toBe('Asset 21');
      expect(result[9].nickName).toBe('Asset 30');
    });

    it('returns last page slice (partial)', () => {
      const result = paginateAssets(assets, 6, 10);
      expect(result).toHaveLength(5);
      expect(result[0].nickName).toBe('Asset 51');
      expect(result[4].nickName).toBe('Asset 55');
    });

    it('clamps to last page when page is too high', () => {
      const result = paginateAssets(assets, 100, 10);
      // Should clamp to page 6 (last page)
      expect(result).toHaveLength(5);
      expect(result[0].nickName).toBe('Asset 51');
    });

    it('clamps to first page when page is too low', () => {
      const result = paginateAssets(assets, 0, 10);
      expect(result).toHaveLength(10);
      expect(result[0].nickName).toBe('Asset 1');
    });
  });

  describe('with itemsPerPage = "all"', () => {
    it('returns all assets', () => {
      const result = paginateAssets(assets, 1, 'all');
      expect(result).toHaveLength(55);
      expect(result).toBe(assets); // same reference since no slicing needed
    });
  });

  describe('with empty array', () => {
    it('returns empty array', () => {
      const result = paginateAssets([], 1, 10);
      expect(result).toHaveLength(0);
    });
  });

  describe('with different page sizes', () => {
    it('works with 25 items per page', () => {
      const result = paginateAssets(assets, 2, 25);
      expect(result).toHaveLength(25);
      expect(result[0].nickName).toBe('Asset 26');
      expect(result[24].nickName).toBe('Asset 50');
    });

    it('works with 50 items per page', () => {
      const result = paginateAssets(assets, 1, 50);
      expect(result).toHaveLength(50);
      expect(result[0].nickName).toBe('Asset 1');
      expect(result[49].nickName).toBe('Asset 50');
    });

    it('works with 100 items per page (more than total)', () => {
      const result = paginateAssets(assets, 1, 100);
      expect(result).toHaveLength(55);
    });
  });
});
