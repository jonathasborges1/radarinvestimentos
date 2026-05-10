import { useEffect, useCallback } from 'react';
import type { Asset } from '../types';

interface JsonViewModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

/**
 * Modal that displays the raw JSON representation of an asset.
 * Shows the data exactly as it would appear in the exported JSON file.
 */
export function JsonViewModal({ asset, isOpen, onClose, isMobile }: JsonViewModalProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !asset) return null;

  const jsonString = JSON.stringify(asset, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
  };

  const modalClasses = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-gray-900'
    : 'fixed inset-0 z-50 flex items-center justify-center p-4';

  const contentClasses = isMobile
    ? 'flex-1 flex flex-col overflow-hidden'
    : 'relative w-full max-w-2xl max-h-[85vh] rounded-lg bg-gray-900 shadow-xl flex flex-col overflow-hidden';

  return (
    <div className={modalClasses} role="dialog" aria-modal="true" aria-labelledby="json-view-title">
      {!isMobile && (
        <div
          className="fixed inset-0 bg-black/60"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div className={contentClasses}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h2 id="json-view-title" className="text-sm font-semibold text-gray-200 truncate">
            <span className="text-gray-400 mr-2">JSON</span>
            {asset.nickName}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Copiar JSON"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px] min-w-[36px]"
              aria-label="Fechar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
}
