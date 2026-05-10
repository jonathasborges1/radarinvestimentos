import { useState, useMemo, useCallback } from 'react';
import type { Asset, SortConfig, SortableColumn } from '../types';
import { sortAssets } from '../utils/sorting';

export interface UseSortingReturn {
  sortConfig: SortConfig;
  toggleSort: (column: SortableColumn) => void;
  sortedAssets: Asset[];
}

/**
 * Hook for managing sorting state and producing sorted asset arrays.
 * - First click on a column → ascending
 * - Second click on same column → descending
 * - Click on a different column → ascending on new column
 *
 * @param assets - Array of assets to sort
 * @returns Sorting state, toggle function, and sorted assets
 */
export function useSorting(assets: Asset[]): UseSortingReturn {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: null,
    direction: 'asc',
  });

  const toggleSort = useCallback((column: SortableColumn) => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        // Same column: toggle direction
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // Different column: start with ascending
      return { column, direction: 'asc' };
    });
  }, []);

  const sortedAssets = useMemo(
    () => sortAssets(assets, sortConfig),
    [assets, sortConfig]
  );

  return { sortConfig, toggleSort, sortedAssets };
}
