import type { Asset, FilterState, FilterOptions } from '../types';

/**
 * Searches assets by a query string across multiple fields (case-insensitive).
 * Fields searched: nickName, product, code, b3Code, ratingName, agencyName, indexers.
 *
 * @param assets - Array of assets to search
 * @param query - Search query string
 * @returns Filtered array of assets matching the query
 */
export function searchAssets(assets: Asset[], query: string): Asset[] {
  if (!query.trim()) {
    return assets;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return assets.filter((asset) => {
    const searchableFields: (string | null | undefined)[] = [
      asset.nickName,
      asset.product,
      String(asset.code),
      asset.b3Code,
      asset.ratingName,
      asset.agencyName,
      asset.indexers,
    ];

    return searchableFields.some(
      (field) => field != null && field.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Parses a fee string (e.g., "19,550%") to extract the numeric value.
 * Returns null if parsing fails.
 */
function parseFeeValue(fee: string | null, prefixedFeeValue?: number | null): number | null {
  if (prefixedFeeValue != null) {
    return prefixedFeeValue;
  }

  if (!fee) {
    return null;
  }

  // Remove % and whitespace, replace comma with dot for parsing
  const cleaned = fee.replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Filters assets based on the provided filter state.
 * Uses AND logic between all active filters.
 *
 * @param assets - Array of assets to filter
 * @param filters - Current filter state
 * @returns Filtered array of assets matching all active filters
 */
export function filterAssets(assets: Asset[], filters: FilterState): Asset[] {
  return assets.filter((asset) => {
    // Selection filters (product, indexer, rating, agency)
    if (filters.product.length > 0) {
      if (!asset.product || !filters.product.includes(asset.product)) {
        return false;
      }
    }

    if (filters.indexer.length > 0) {
      if (!asset.indexers || !filters.indexer.includes(asset.indexers)) {
        return false;
      }
    }

    if (filters.rating.length > 0) {
      if (!asset.ratingName || !filters.rating.includes(asset.ratingName)) {
        return false;
      }
    }

    if (filters.agency.length > 0) {
      if (!asset.agencyName || !filters.agency.includes(asset.agencyName)) {
        return false;
      }
    }

    // Interest frequency filter (descriptionInterestrates)
    if (filters.interestFrequency.length > 0) {
      if (!asset.descriptionInterestrates) {
        return false;
      }
      const normalizedInterest = asset.descriptionInterestrates.toLowerCase();
      const matchesAny = filters.interestFrequency.some(
        (freq) => normalizedInterest.includes(freq.toLowerCase())
      );
      if (!matchesAny) {
        return false;
      }
    }

    // Amortization frequency filter (descriptionAmortization)
    if (filters.amortizationFrequency.length > 0) {
      if (!asset.descriptionAmortization) {
        return false;
      }
      const normalizedAmort = asset.descriptionAmortization.toLowerCase();
      const matchesAny = filters.amortizationFrequency.some(
        (freq) => normalizedAmort.includes(freq.toLowerCase())
      );
      if (!matchesAny) {
        return false;
      }
    }

    // Boolean filters (qualifiedInvestor, professionalInvestor, generalInvestor, incentive)
    if (filters.qualifiedInvestor !== null) {
      const expected = filters.qualifiedInvestor ? 'S' : 'N';
      if (asset.qualifiedInvestor !== expected) {
        return false;
      }
    }

    if (filters.professionalInvestor !== null) {
      const expected = filters.professionalInvestor ? 'S' : 'N';
      if (asset.professionalInvestor !== expected) {
        return false;
      }
    }

    if (filters.generalInvestor !== null) {
      const expected = filters.generalInvestor ? 'S' : 'N';
      if (asset.generalInvestor !== expected) {
        return false;
      }
    }

    if (filters.incentive !== null) {
      const expected = filters.incentive ? 'S' : 'N';
      if (asset.incentive !== expected) {
        return false;
      }
    }

    // Boolean filter for guaranteeFGC (field is boolean, not "S"/"N")
    if (filters.guaranteeFGC !== null) {
      if (asset.guaranteeFGC !== filters.guaranteeFGC) {
        return false;
      }
    }

    // Date range filter (maturityDate)
    if (filters.maturityDateStart !== null || filters.maturityDateEnd !== null) {
      if (!asset.maturityDate) {
        return false;
      }

      if (filters.maturityDateStart !== null && asset.maturityDate < filters.maturityDateStart) {
        return false;
      }

      if (filters.maturityDateEnd !== null && asset.maturityDate > filters.maturityDateEnd) {
        return false;
      }
    }

    // Numeric range filter (fee)
    if (filters.feeMin !== null || filters.feeMax !== null) {
      const feeValue = parseFeeValue(asset.fee, asset.prefixedFeeValue);
      if (feeValue === null) {
        return false;
      }

      if (filters.feeMin !== null && feeValue < filters.feeMin) {
        return false;
      }

      if (filters.feeMax !== null && feeValue > filters.feeMax) {
        return false;
      }
    }

    // Numeric range filter (risk)
    if (filters.riskMin !== null || filters.riskMax !== null) {
      if (asset.riskScore == null) {
        return false;
      }

      if (filters.riskMin !== null && asset.riskScore < filters.riskMin) {
        return false;
      }

      if (filters.riskMax !== null && asset.riskScore > filters.riskMax) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Known frequency keywords to extract from description fields.
 */
const FREQUENCY_KEYWORDS = [
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Quadrimestral',
  'Semestral',
  'Anual',
  'Vencimento',
  'Bullet',
] as const;

/**
 * Extracts frequency keywords found in a description string.
 */
function extractFrequencies(description: string | null | undefined): string[] {
  if (!description) return [];
  const lower = description.toLowerCase();
  return FREQUENCY_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Extracts unique sorted filter options from the loaded assets.
 *
 * @param assets - Array of assets to extract options from
 * @returns FilterOptions with unique sorted values for each category
 */
export function extractFilterOptions(assets: Asset[]): FilterOptions {
  const productsSet = new Set<string>();
  const indexersSet = new Set<string>();
  const ratingsSet = new Set<string>();
  const agenciesSet = new Set<string>();
  const interestFreqSet = new Set<string>();
  const amortizationFreqSet = new Set<string>();

  for (const asset of assets) {
    if (asset.product) {
      productsSet.add(asset.product);
    }
    if (asset.indexers) {
      indexersSet.add(asset.indexers);
    }
    if (asset.ratingName) {
      ratingsSet.add(asset.ratingName);
    }
    if (asset.agencyName) {
      agenciesSet.add(asset.agencyName);
    }
    for (const freq of extractFrequencies(asset.descriptionInterestrates)) {
      interestFreqSet.add(freq);
    }
    for (const freq of extractFrequencies(asset.descriptionAmortization)) {
      amortizationFreqSet.add(freq);
    }
  }

  return {
    products: [...productsSet].sort(),
    indexers: [...indexersSet].sort(),
    ratings: [...ratingsSet].sort(),
    agencies: [...agenciesSet].sort(),
    interestFrequencies: [...interestFreqSet].sort(),
    amortizationFrequencies: [...amortizationFreqSet].sort(),
  };
}
