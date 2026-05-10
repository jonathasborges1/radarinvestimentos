import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Asset, FilterState } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { useDebounce } from './useDebounce';
import { searchAssets, filterAssets } from '../utils/filtering';

// search is ephemeral — not persisted between sessions
type PersistedFilters = Omit<FilterState, 'search'>;

const STORAGE_KEY = 'yield-radar-filters';
const IS_DEV = import.meta.env.DEV;

const INITIAL_PERSISTED: PersistedFilters = {
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

async function loadFiltersFromFile(): Promise<PersistedFilters | null> {
  try {
    const res = await fetch('/api/filters');
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as PersistedFilters)
      : null;
  } catch {
    return null;
  }
}

async function saveFiltersToFile(filters: PersistedFilters): Promise<void> {
  try {
    await fetch('/api/filters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });
  } catch {
    console.warn('[YieldRadar] Falha ao salvar filtros em data/filters.json');
  }
}

export interface UseFiltersReturn {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  filteredAssets: Asset[];
}

export function useFilters(assets: Asset[]): UseFiltersReturn {
  const [search, setSearch] = useState('');
  const [persisted, setPersisted] = useLocalStorage<PersistedFilters>(
    STORAGE_KEY,
    INITIAL_PERSISTED
  );

  // On mount in dev, load from file (takes priority over localStorage)
  useEffect(() => {
    if (!IS_DEV) return;
    loadFiltersFromFile().then((data) => {
      if (data) setPersisted(data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to file on every change in dev
  useEffect(() => {
    if (!IS_DEV) return;
    saveFiltersToFile(persisted);
  }, [persisted]);

  const filters = useMemo<FilterState>(
    () => ({ search, ...persisted }),
    [search, persisted]
  );

  const debouncedSearch = useDebounce(filters.search, 300);

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      if (key === 'search') {
        setSearch(value as string);
      } else {
        setPersisted((prev) => ({ ...prev, [key]: value }));
      }
    },
    [setPersisted]
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setPersisted(INITIAL_PERSISTED);
  }, [setPersisted]);

  const filteredAssets = useMemo(() => {
    const searched = searchAssets(assets, debouncedSearch);
    return filterAssets(searched, filters);
  }, [assets, debouncedSearch, filters]);

  return { filters, setFilter, clearFilters, filteredAssets };
}
