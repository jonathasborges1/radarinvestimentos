import { useState, useRef, useEffect } from 'react';
import { ALL_COLUMNS } from '../config/columns';
import type { ColumnKey } from '../types/column';

interface ColumnToggleProps {
  visibleColumns: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onShowAll: () => void;
  onReset: () => void;
}

export function ColumnToggle({ visibleColumns, onToggle, onShowAll, onReset }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const toggleable = ALL_COLUMNS.filter((c) => !c.pinned);
  const originalCols = toggleable.filter((c) => c.group === 'original');
  const customCols = toggleable.filter((c) => c.group === 'custom');
  const visibleCount = toggleable.filter((c) => visibleColumns.has(c.key)).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Colunas
        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {visibleCount}/{toggleable.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-3 max-h-80 overflow-y-auto space-y-0.5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-1">
              Dados do ativo
            </p>
            {originalCols.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
              </label>
            ))}

            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2 pb-1">
              Campos personalizados
            </p>
            {customCols.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(col.key)}
                  onChange={() => onToggle(col.key)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
              </label>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex gap-2">
            <button
              type="button"
              onClick={() => { onShowAll(); }}
              className="flex-1 text-xs py-1.5 px-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
            >
              Exibir todas
            </button>
            <button
              type="button"
              onClick={() => { onReset(); }}
              className="flex-1 text-xs py-1.5 px-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium"
            >
              Padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
