import type { Asset, SortConfig, SortableColumn } from '../types';
import { computePaymentMetrics } from './paymentMetrics';

/**
 * Parses a fee string (e.g., "19,550%") to a numeric value.
 * Uses prefixedFeeValue if available.
 */
function parseFeeToNumber(asset: Asset): number | null {
  if (asset.prefixedFeeValue != null) {
    return asset.prefixedFeeValue;
  }

  if (!asset.fee) {
    return null;
  }

  const cleaned = asset.fee.replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

/**
 * Gets the comparable value for a given asset and column.
 * Returns null for missing/undefined values.
 */
function getColumnValue(asset: Asset, column: SortableColumn): string | number | null {
  switch (column) {
    case 'nickName':
      return asset.nickName ?? null;
    case 'product':
      return asset.product ?? null;
    case 'fee':
      return parseFeeToNumber(asset);
    case 'maturityDate':
      return asset.maturityDate ?? null;
    case 'puMinValue':
      return asset.puMinValue ?? null;
    case 'paymentVsPuMin': {
      const metrics = computePaymentMetrics(asset.paymentSchedule, asset.puMinValue);
      return metrics.ratio12m ?? metrics.ratio6m;
    }
    case 'quantityAvailable':
      return asset.quantityAvailable ?? null;
    case 'riskScore':
      return asset.riskScore ?? null;
    case 'ratingName':
      return asset.ratingName ?? null;
    case 'code':
      return asset.code ?? null;
    case 'b3Code':
      return asset.b3Code ?? null;
    default:
      return null;
  }
}

/**
 * Compares two values for sorting. Null/undefined values are pushed to the end.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareValues(a: string | number | null, b: string | number | null, direction: 'asc' | 'desc'): number {
  // Push nulls to the end regardless of direction
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  let result: number;

  if (typeof a === 'string' && typeof b === 'string') {
    result = a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
  } else {
    // Convert to numbers for comparison
    const numA = typeof a === 'string' ? parseFloat(a) : a;
    const numB = typeof b === 'string' ? parseFloat(b) : b;

    if (isNaN(numA as number) && isNaN(numB as number)) return 0;
    if (isNaN(numA as number)) return 1;
    if (isNaN(numB as number)) return -1;

    result = (numA as number) - (numB as number);
  }

  return direction === 'desc' ? -result : result;
}

/**
 * Sorts an array of assets based on the provided sort configuration.
 * Returns a new array (does not mutate the input).
 * When column is null, returns a shallow copy of the input unchanged.
 *
 * @param assets - Array of assets to sort
 * @param sortConfig - Configuration specifying column and direction
 * @returns A new sorted array of assets
 */
export function sortAssets(assets: Asset[], sortConfig: SortConfig): Asset[] {
  if (!sortConfig.column) {
    return [...assets];
  }

  const { column, direction } = sortConfig;

  return [...assets].sort((a, b) => {
    const valueA = getColumnValue(a, column);
    const valueB = getColumnValue(b, column);
    return compareValues(valueA, valueB, direction);
  });
}
