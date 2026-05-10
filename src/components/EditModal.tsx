import { useState, useEffect, useRef, useCallback } from 'react';
import type { Asset, PaymentEvent } from '../types';
import { FiduciaryAgentInput } from './FiduciaryAgentInput';
import { TagsInput } from './TagsInput';
import { TrackingStatusSelect } from './TrackingStatusSelect';
import { PaymentScheduleSection } from './PaymentScheduleSection';
import { displayValue } from '../utils/formatting';
import { isLocalhost, fetchPaymentSchedule } from '../utils/scraper-client';
import { fetchPaymentScheduleViaProvider } from '../services/paymentSchedule';
import { parseEcoagroTotal } from '../services/paymentSchedule/providers/ecoagroPaymentScheduleProvider';

interface EditModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onSave: (updatedAsset: Asset) => void;
  onClose: () => void;
  /**
   * Disparado logo após um fetch de agenda de pagamentos bem-sucedido.
   * Permite ao container persistir os dados imediatamente (localStorage +
   * data/db.json) sem exigir clique em "Salvar".
   */
  onPaymentsFetched?: (
    code: number | string,
    payments: PaymentEvent[],
    fetchedAt: string,
  ) => void;
  isMobile: boolean;
}

interface EditableFields {
  b3Code: string;
  fiduciaryAgentUrl: string;
  notes: string;
  favorite: boolean;
  tags: string[];
  trackingStatus: string;
}

/**
 * Modal for editing custom fields of an asset.
 * Displays original fields as read-only and editable custom fields.
 * Fullscreen on mobile, centered overlay on desktop.
 */
export function EditModal({ asset, isOpen, onSave, onClose, onPaymentsFetched, isMobile }: EditModalProps) {
  const [editableFields, setEditableFields] = useState<EditableFields>({
    b3Code: '',
    fiduciaryAgentUrl: '',
    notes: '',
    favorite: false,
    tags: [],
    trackingStatus: '',
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const [scrapingStatus, setScrapingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeLogs, setScrapeLogs] = useState<string[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentEvent[]>([]);

  // Initialize editable fields when asset changes
  useEffect(() => {
    if (asset) {
      setEditableFields({
        b3Code: asset.b3Code || '',
        fiduciaryAgentUrl: asset.fiduciaryAgentUrl || '',
        notes: asset.notes || '',
        favorite: asset.favorite || false,
        tags: asset.tags || [],
        trackingStatus: asset.trackingStatus || '',
      });
      setPaymentSchedule(asset.paymentSchedule || []);
      setScrapingStatus('idle');
      setScrapeError(null);
      setScrapeLogs([]);
    }
  }, [asset]);

  // Focus trap: focus the modal when opened
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  const handleFetchPayments = useCallback(async () => {
    const url = editableFields.fiduciaryAgentUrl;
    if (!url || !asset) return;

    setScrapingStatus('loading');
    setScrapeError(null);
    setScrapeLogs([]);

    // 1. Tenta a nova abstração de provedores (Ecoagro inicialmente).
    // Passa também o b3Code editado no formulário (ainda não persistido)
    // para que o provider possa sintetizar a URL do histórico mesmo se o
    // usuário acabou de digitá-lo nesta sessão.
    const providerResult = await fetchPaymentScheduleViaProvider({
      fiduciaryAgentUrl: url,
      asset: {
        code: asset.code,
        nickName: asset.nickName,
        b3Code: editableFields.b3Code || asset.b3Code,
      },
    });

    if (providerResult.ok) {
      const events: PaymentEvent[] = providerResult.items.map(item => ({
        date: item.date,
        type: 'Pagamento',
        value: parseEcoagroTotal(item.total),
        rawValue: item.total,
      }));
      const fetchedAt = new Date().toISOString();
      setPaymentSchedule(events);
      setScrapeLogs([
        `[${providerResult.provider}] ${events.length} pagamento(s) com TOTAL > 0 extraído(s).`,
      ]);
      setScrapingStatus('success');
      // Persistência imediata (localStorage + data/db.json em dev).
      onPaymentsFetched?.(asset.code, events, fetchedAt);
      return;
    }

    // Provider conhecido falhou (ex.: timeout, página vazia): exibimos o erro.
    if (!providerResult.unsupported) {
      setScrapeError(providerResult.error);
      setScrapingStatus('error');
      return;
    }

    // 2. Fallback: scraper legado (Opea / genérico).
    const legacy = await fetchPaymentSchedule(url);
    setScrapeLogs(legacy.logs || []);
    if (legacy.success && legacy.payments) {
      const fetchedAt = new Date().toISOString();
      setPaymentSchedule(legacy.payments);
      setScrapingStatus('success');
      onPaymentsFetched?.(asset.code, legacy.payments, fetchedAt);
    } else {
      setScrapeError(legacy.error || 'Erro desconhecido');
      setScrapingStatus('error');
    }
  }, [editableFields.fiduciaryAgentUrl, asset, onPaymentsFetched]);

  if (!isOpen || !asset) {
    return null;
  }

  const handleSave = () => {
    const updatedAsset: Asset = {
      ...asset,
      b3Code: editableFields.b3Code || undefined,
      fiduciaryAgentUrl: editableFields.fiduciaryAgentUrl || undefined,
      notes: editableFields.notes || undefined,
      favorite: editableFields.favorite || undefined,
      tags: editableFields.tags.length > 0 ? editableFields.tags : undefined,
      trackingStatus: (editableFields.trackingStatus as Asset['trackingStatus']) || undefined,
      paymentSchedule: paymentSchedule.length > 0 ? paymentSchedule : undefined,
      paymentScheduleUpdatedAt:
        paymentSchedule.length > 0
          ? asset.paymentScheduleUpdatedAt || new Date().toISOString()
          : undefined,
    };
    onSave(updatedAsset);
  };

  const handleCancel = () => {
    onClose();
  };

  const modalClasses = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';

  const contentClasses = isMobile
    ? 'flex-1 flex flex-col overflow-hidden'
    : 'relative w-full max-w-2xl max-h-[90vh] rounded-lg bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden';

  return (
    <div className={modalClasses} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      {/* Backdrop (desktop only) */}
      {!isMobile && (
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={handleCancel}
          aria-hidden="true"
        />
      )}

      <div ref={modalRef} className={contentClasses}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
          <h2 id="edit-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Editar Ativo
          </h2>
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px]"
            aria-label="Fechar modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-6">
          {/* Changed fields from last incremental upload */}
          <ChangedFieldsPanel asset={asset} />

          {/* Read-only reference fields */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Informações do Ativo (somente leitura)
            </legend>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-gray-50 dark:bg-gray-900/50 rounded-md p-3">
              <ReadOnlyField label="Nome" value={displayValue(asset.nickName)} />
              <ReadOnlyField label="Produto" value={displayValue(asset.product)} />
              <ReadOnlyField label="Taxa" value={displayValue(asset.fee)} />
              <ReadOnlyField label="Indexador" value={displayValue(asset.indexers)} />
              <ReadOnlyField label="Vencimento" value={displayValue(asset.maturityDate)} />
              <ReadOnlyField label="Código" value={displayValue(asset.code)} />
            </dl>
          </fieldset>

          {/* Editable fields */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Campos Editáveis
            </legend>

            {/* b3Code */}
            <div className="space-y-2">
              <label htmlFor="edit-b3code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Código B3
              </label>
              <input
                id="edit-b3code"
                type="text"
                value={editableFields.b3Code}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, b3Code: e.target.value }))}
                placeholder="Ex: CPTS11"
                className={`block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 ${isMobile ? 'text-base' : ''}`}
              />
            </div>

            {/* fiduciaryAgentUrl */}
            <FiduciaryAgentInput
              value={editableFields.fiduciaryAgentUrl}
              onChange={(url) => setEditableFields((prev) => ({ ...prev, fiduciaryAgentUrl: url }))}
            />

            {/* notes */}
            <div className="space-y-2">
              <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Observações
              </label>
              <textarea
                id="edit-notes"
                value={editableFields.notes}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Anotações sobre o ativo..."
                rows={3}
                className={`block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder-gray-400 dark:placeholder-gray-500 ${isMobile ? 'text-base' : ''}`}
              />
            </div>

            {/* favorite */}
            <div className="flex items-center gap-2">
              <input
                id="edit-favorite"
                type="checkbox"
                checked={editableFields.favorite}
                onChange={(e) => setEditableFields((prev) => ({ ...prev, favorite: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
              />
              <label htmlFor="edit-favorite" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Marcar como favorito
              </label>
            </div>

            {/* tags */}
            <TagsInput
              tags={editableFields.tags}
              onChange={(tags) => setEditableFields((prev) => ({ ...prev, tags }))}
            />

            {/* trackingStatus */}
            <TrackingStatusSelect
              value={editableFields.trackingStatus}
              onChange={(status) => setEditableFields((prev) => ({ ...prev, trackingStatus: status }))}
            />
          </fieldset>

          {/* Payment Schedule Section — only on localhost */}
          {isLocalhost() && (
            <PaymentScheduleSection
              payments={paymentSchedule}
              scrapingStatus={scrapingStatus}
              scrapeError={scrapeError}
              scrapeLogs={scrapeLogs}
              hasUrl={!!editableFields.fiduciaryAgentUrl}
              updatedAt={asset.paymentScheduleUpdatedAt}
              onFetch={handleFetchPayments}
              onClear={() => setPaymentSchedule([])}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-Only Field                                                     */
/* ------------------------------------------------------------------ */

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 mt-0.5">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Changed Fields Panel (shows diffs from last incremental upload)    */
/* ------------------------------------------------------------------ */

function formatDiffValue(value: unknown): string {
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

function ChangedFieldsPanel({ asset }: { asset: Asset }) {
  const entries = asset.updatedFields ? Object.entries(asset.updatedFields) : [];
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="Campos atualizados no último upload"
      className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <p className="font-semibold mb-1.5 flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
        Atualizado no último upload
      </p>
      <ul className="space-y-1 font-mono">
        {entries.map(([field, change]) => (
          <li key={field} className="flex flex-wrap items-baseline gap-1">
            <span className="font-semibold not-italic">{field}:</span>
            <span className="line-through opacity-70">{formatDiffValue(change.oldValue)}</span>
            <span aria-hidden>→</span>
            <span>{formatDiffValue(change.newValue)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
