import { useCallback, useMemo, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { ALL_COLUMNS } from '../config/columns';
import type { ColumnKey } from '../types/column';
import { loadPreferences, patchPreferences } from '../utils/preferencesFile';

const STORAGE_KEY = 'yield-radar-columns';
const IS_DEV = import.meta.env.DEV;

const DEFAULT_VISIBLE: ColumnKey[] = ALL_COLUMNS
  .filter((c) => c.defaultVisible)
  .map((c) => c.key);

export function useColumnVisibility() {
  const [visibleKeys, setVisibleKeys] = useLocalStorage<ColumnKey[]>(
    STORAGE_KEY,
    DEFAULT_VISIBLE
  );

  const visibleColumns = useMemo(() => new Set(visibleKeys), [visibleKeys]);

  // On mount in dev, load from file (takes priority over localStorage)
  useEffect(() => {
    if (!IS_DEV) return;
    loadPreferences().then((prefs) => {
      if (prefs.columns && prefs.columns.length > 0) setVisibleKeys(prefs.columns);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync to file on every change in dev
  useEffect(() => {
    if (!IS_DEV) return;
    patchPreferences({ columns: visibleKeys });
  }, [visibleKeys]);

  const toggle = useCallback(
    (key: ColumnKey) => {
      const col = ALL_COLUMNS.find((c) => c.key === key);
      if (col?.pinned) return;

      if (visibleColumns.has(key)) {
        setVisibleKeys(visibleKeys.filter((k) => k !== key));
      } else {
        // Maintain the original column order
        const next = ALL_COLUMNS
          .filter((c) => visibleColumns.has(c.key) || c.key === key)
          .map((c) => c.key);
        setVisibleKeys(next);
      }
    },
    [visibleKeys, visibleColumns, setVisibleKeys]
  );

  const showAll = useCallback(() => {
    setVisibleKeys(ALL_COLUMNS.map((c) => c.key));
  }, [setVisibleKeys]);

  const resetToDefault = useCallback(() => {
    setVisibleKeys(DEFAULT_VISIBLE);
  }, [setVisibleKeys]);

  const reorder = useCallback(
    (newOrder: ColumnKey[]) => {
      setVisibleKeys(newOrder);
    },
    [setVisibleKeys]
  );

  return { orderedVisible: visibleKeys, visibleColumns, toggle, showAll, resetToDefault, reorder };
}
