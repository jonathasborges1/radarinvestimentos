import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UploadAssetSummary, UploadHistoryItem } from '../types';

interface UploadHistoryModalProps {
  history: UploadHistoryItem[];
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

/**
 * Modal that lists the last imported JSON files (max 30) and lets the
 * user inspect any single upload in detail (totals + per-asset status
 * + raw JSON preview). Read-only — never mutates the current dataset.
 */
export function UploadHistoryModal({ history, isOpen, onClose, isMobile }: UploadHistoryModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Selection only matters while the modal is open. Resetting it on
  // close happens in `handleClose`; if the parent toggles `isOpen` off
  // some other way, the early return below unmounts the inner UI.
  const selected = useMemo(
    () => (isOpen ? history.find((item) => item.id === selectedId) ?? null : null),
    [isOpen, history, selectedId]
  );

  if (!isOpen) return null;

  const wrapperClasses = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';

  const contentClasses = isMobile
    ? 'flex-1 flex flex-col overflow-hidden'
    : 'relative w-full max-w-4xl max-h-[85vh] rounded-lg bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden';

  return (
    <div className={wrapperClasses} role="dialog" aria-modal="true" aria-labelledby="upload-history-title">
      {!isMobile && (
        <div
          className="fixed inset-0 bg-black/50"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div className={contentClasses}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Voltar para a lista de uploads"
                title="Voltar"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 id="upload-history-title" className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {selected ? selected.fileName : 'Histórico de uploads'}
            </h2>
            {!selected && (
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {history.length}/30
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Fechar histórico"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ainda não há uploads registrados. Importe um arquivo .json para começar.
            </p>
          ) : selected ? (
            <UploadDetailView item={selected} />
          ) : (
            <UploadList history={history} onSelect={setSelectedId} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload List                                                         */
/* ------------------------------------------------------------------ */

function UploadList({
  history,
  onSelect,
}: {
  history: UploadHistoryItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {history.map((item) => (
        <li key={item.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={item.fileName}>
              {item.fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(item.uploadedAt)}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
              <Stat label="Total" value={item.totalRecords} />
              <Stat label="Novos" value={item.newRecords} tone="green" />
              <Stat label="Atualizados" value={item.updatedRecords} tone="amber" />
              <Stat label="Sem alteração" value={item.unchangedRecords} tone="gray" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Visualizar
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Upload Detail                                                       */
/* ------------------------------------------------------------------ */

function UploadDetailView({ item }: { item: UploadHistoryItem }) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <DetailField label="Enviado em" value={formatDateTime(item.uploadedAt)} />
          <DetailField label="Total" value={String(item.totalRecords)} />
          <DetailField label="Novos" value={String(item.newRecords)} />
          <DetailField label="Atualizados" value={String(item.updatedRecords)} />
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Ativos no upload
        </h3>
        {item.changesSummary.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Arquivo sem ativos.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
            {item.changesSummary.map((entry) => (
              <SummaryRow key={entry.assetKey} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
        >
          {showJson ? 'Ocultar JSON original' : 'Ver JSON original'}
        </button>
        {showJson && (
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-gray-900 p-3 text-xs leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words">
            {JSON.stringify({ data: item.originalJson }, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}

function SummaryRow({ entry }: { entry: UploadAssetSummary }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = entry.status === 'updated' && entry.changedFields && Object.keys(entry.changedFields).length > 0;

  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate" title={entry.nickName}>
            {entry.nickName}
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            {entry.indexers ?? '—'} · {entry.maturityDate ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={entry.status} />
          {hasChanges && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
            >
              {expanded ? 'Ocultar' : 'Ver alterações'}
            </button>
          )}
        </div>
      </div>
      {expanded && hasChanges && (
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-gray-700 dark:text-gray-300">
          {Object.entries(entry.changedFields!).map(([field, change]) => (
            <li key={field} className="flex flex-wrap items-baseline gap-1">
              <span className="font-semibold">{field}:</span>
              <span className="line-through opacity-70">{formatValue(change.oldValue)}</span>
              <span aria-hidden>→</span>
              <span>{formatValue(change.newValue)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                       */
/* ------------------------------------------------------------------ */

function Stat({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'amber' }) {
  const toneClasses =
    tone === 'green'
      ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${toneClasses}`}>
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: UploadAssetSummary['status'] }) {
  const map = {
    new: { label: 'Novo', class: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
    updated: { label: 'Atualizado', class: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
    unchanged: { label: 'Sem alteração', class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  } as const;
  const meta = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.class}`}>{meta.label}</span>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 mt-0.5">{value}</dd>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
