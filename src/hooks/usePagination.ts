import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Asset } from '../types';
import { calculatePageInfo, paginateAssets } from '../utils/pagination';
import { useLocalStorage } from './useLocalStorage';
import { loadPreferences, patchPreferences } from '../utils/preferencesFile';

const ITEMS_PER_PAGE_KEY = 'yield-radar-items-per-page';
const DEFAULT_ITEMS_PER_PAGE: number | 'all' = 25;
const IS_DEV = import.meta.env.DEV;

function isValidItemsPerPage(value: unknown): value is number | 'all' {
  return value === 'all' || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

export interface UsePaginationReturn {
  currentPage: number;
  itemsPerPage: number | 'all';
  totalPages: number;
  paginatedAssets: Asset[];
  setPage: (page: number) => void;
  setItemsPerPage: (count: number | 'all') => void;
  pageInfo: { start: number; end: number; total: number };
}

/**
 * Hook for managing pagination state.
 * Resets to the first page when the total number of items changes (e.g., filters change).
 *
 * @param assets - Array of assets to paginate
 * @returns Pagination state, controls, and paginated assets
 */
export function usePagination(assets: Asset[]): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPageState] = useLocalStorage<number | 'all'>(
    ITEMS_PER_PAGE_KEY,
    DEFAULT_ITEMS_PER_PAGE
  );

  // Track previous length to detect changes (filters applied)
  const prevLengthRef = useRef(assets.length);

  useEffect(() => {
    if (assets.length !== prevLengthRef.current) {
      setCurrentPage(1);
      prevLengthRef.current = assets.length;
    }
  }, [assets.length]);

  // Em dev, hidrata a partir de data/preferences.json (prioridade sobre localStorage).
  useEffect(() => {
    if (!IS_DEV) return;
    loadPreferences().then((prefs) => {
      if (isValidItemsPerPage(prefs.itemsPerPage)) {
        setItemsPerPageState(prefs.itemsPerPage);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Em dev, sincroniza para o arquivo a cada mudança.
  useEffect(() => {
    if (!IS_DEV) return;
    patchPreferences({ itemsPerPage });
  }, [itemsPerPage]);

  const info = useMemo(
    () => calculatePageInfo(assets.length, currentPage, itemsPerPage),
    [assets.length, currentPage, itemsPerPage]
  );

  const paginatedAssets = useMemo(
    () => paginateAssets(assets, currentPage, itemsPerPage),
    [assets, currentPage, itemsPerPage]
  );

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setItemsPerPage = useCallback((count: number | 'all') => {
    setItemsPerPageState(count);
    setCurrentPage(1);
  }, [setItemsPerPageState]);

  const pageInfo = useMemo(
    () => ({ start: info.start, end: info.end, total: assets.length }),
    [info.start, info.end, assets.length]
  );

  return {
    currentPage,
    itemsPerPage,
    totalPages: info.totalPages,
    paginatedAssets,
    setPage,
    setItemsPerPage,
    pageInfo,
  };
}
