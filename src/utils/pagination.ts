import type { Asset } from '../types';

export interface PageInfo {
  start: number;
  end: number;
  totalPages: number;
}

/**
 * Calculates pagination information.
 * start and end are 1-indexed for display purposes.
 *
 * @param totalItems - Total number of items
 * @param currentPage - Current page number (1-indexed)
 * @param itemsPerPage - Number of items per page, or 'all' to show everything
 * @returns Object with start, end (1-indexed), and totalPages
 */
export function calculatePageInfo(
  totalItems: number,
  currentPage: number,
  itemsPerPage: number | 'all'
): PageInfo {
  if (totalItems === 0) {
    return { start: 0, end: 0, totalPages: 0 };
  }

  if (itemsPerPage === 'all') {
    return { start: 1, end: totalItems, totalPages: 1 };
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  // Clamp currentPage to valid range
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  const start = (safePage - 1) * itemsPerPage + 1;
  const end = Math.min(safePage * itemsPerPage, totalItems);

  return { start, end, totalPages };
}

/**
 * Returns the slice of assets for the current page.
 *
 * @param assets - Full array of assets
 * @param currentPage - Current page number (1-indexed)
 * @param itemsPerPage - Number of items per page, or 'all' to return everything
 * @returns Sliced array of assets for the current page
 */
export function paginateAssets(
  assets: Asset[],
  currentPage: number,
  itemsPerPage: number | 'all'
): Asset[] {
  if (itemsPerPage === 'all') {
    return assets;
  }

  const totalPages = Math.ceil(assets.length / itemsPerPage);
  const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));

  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  return assets.slice(startIndex, endIndex);
}
