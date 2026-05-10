import { useMemo } from 'react';
import type { PaymentEvent } from '../types';
import { formatCurrency, formatCurrencyExact } from '../utils/formatting';
import {
  computePaymentMetrics,
  sortPaymentsNewestFirst,
  type PaymentRating,
} from '../utils/paymentMetrics';

interface PaymentScheduleSectionProps {
  payments: PaymentEvent[];
  puMinValue?: number | null;
  scrapingStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  scrapeError: string | null;
  scrapeLogs: string[];
  b3CodeMismatch?: { expected: string; claimed: string; provider: string; url: string } | null;
  hasUrl: boolean;
  updatedAt?: string;
  onFetch: () => void;
  onClear: () => void;
}

const RATING_LABEL: Record<PaymentRating, string> = {
  ruim: 'ativo ruim',
  regular: 'ativo regular',
  excelente: 'ativo excelente',
};

const RATING_CLASS: Record<PaymentRating, string> = {
  ruim: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  regular: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  excelente: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

function formatPercent(ratio: number | null): string {
  if (ratio == null) return '—';
  return `${(ratio * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Section in the edit modal that displays payment schedule data.
 * Only visible when running on localhost.
 * Allows fetching payment data from the fiduciary agent's website via local proxy.
 */
export function PaymentScheduleSection({
  payments,
  puMinValue,
  scrapingStatus,
  scrapeError,
  scrapeLogs,
  b3CodeMismatch,
  hasUrl,
  updatedAt,
  onFetch,
  onClear,
}: PaymentScheduleSectionProps) {
  const sortedPayments = useMemo(
    () => sortPaymentsNewestFirst(payments),
    [payments]
  );
  const metrics = useMemo(
    () => computePaymentMetrics(sortedPayments, puMinValue),
    [sortedPayments, puMinValue]
  );
  // Esconde o bloco 12m quando não há pagamentos mais antigos que 6 meses:
  // o ratio seria idêntico ao de 6m e o "ativo" não tem histórico de 12m.
  const show12m = metrics.count12m > metrics.count6m;
  return (
    <fieldset className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
      <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Agenda de Pagamentos
        <span className="text-xs font-normal text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
          localhost only
        </span>
      </legend>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onFetch}
          disabled={!hasUrl || scrapingStatus === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scrapingStatus === 'loading' ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Buscando...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {sortedPayments.length > 0 ? 'Atualizar' : 'Buscar Pagamentos'}
            </>
          )}
        </button>

        {sortedPayments.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Limpar
          </button>
        )}

        {!hasUrl && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            Preencha a URL do agente fiduciário primeiro.
          </p>
        )}
      </div>

      {/* Error message */}
      {scrapingStatus === 'error' && scrapeError && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5">
          <p className="text-xs text-red-700 dark:text-red-300">{scrapeError}</p>
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
            Verifique se o proxy está rodando: <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">node scripts/proxy-scraper.mjs</code>
          </p>
        </div>
      )}

      {/* Divergência de Código B3 entre URL e ativo */}
      {b3CodeMismatch && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-2.5">
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            ⚠ Divergência de Código B3
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            A URL do agente <span className="font-semibold">{b3CodeMismatch.provider}</span> aponta para o ativo
            {' '}<code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{b3CodeMismatch.claimed}</code>,
            mas o Código B3 cadastrado neste ativo é
            {' '}<code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{b3CodeMismatch.expected}</code>.
          </p>
          <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 break-all">
            URL: {b3CodeMismatch.url}
          </p>
          <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">
            Verifique se a URL está correta ou se o Código B3 do ativo está certo. Esta URL foi ignorada na busca.
          </p>
        </div>
      )}

      {/* Empty: fetch ok mas tabela do agente está zerada */}
      {scrapingStatus === 'empty' && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Foi possível resgatar as informações, mas a tabela do agente fiduciário está zerada — nenhum pagamento com TOTAL &gt; 0 até o momento.
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            Comum em ativos ainda em carência ou que ainda não tiveram o primeiro pagamento.
          </p>
        </div>
      )}

      {/* Success message */}
      {scrapingStatus === 'success' && sortedPayments.length > 0 && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ {sortedPayments.length} pagamento(s) encontrado(s) e salvo(s) localmente.
        </p>
      )}

      {/* Updated at info */}
      {updatedAt && sortedPayments.length > 0 && scrapingStatus !== 'success' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Última atualização: {new Date(updatedAt).toLocaleDateString('pt-BR')} às {new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Resumo de performance */}
      {sortedPayments.length > 0 && (metrics.avg6m != null || metrics.avg12m != null) && (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Média de pagamento vs. PU mínimo
            </h4>
            {metrics.rating && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${RATING_CLASS[metrics.rating]}`}>
                {RATING_LABEL[metrics.rating]}
              </span>
            )}
          </div>

          <dl className={`grid ${show12m ? 'grid-cols-2' : 'grid-cols-1'} gap-x-4 gap-y-1 text-xs`}>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Média 6 meses</dt>
              <dd className="text-gray-900 dark:text-gray-100 font-medium">
                {metrics.avg6m != null ? formatCurrency(metrics.avg6m) : '—'}
                {metrics.ratio6m != null && (
                  <span className="ml-1 text-gray-500 dark:text-gray-400">({formatPercent(metrics.ratio6m)})</span>
                )}
                {metrics.count6m > 0 && (
                  <span className="ml-1 text-[10px] text-gray-400">· {metrics.count6m} pagto(s)</span>
                )}
              </dd>
            </div>
            {show12m && (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Média 12 meses</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-medium">
                  {metrics.avg12m != null ? formatCurrency(metrics.avg12m) : '—'}
                  {metrics.ratio12m != null && (
                    <span className="ml-1 text-gray-500 dark:text-gray-400">({formatPercent(metrics.ratio12m)})</span>
                  )}
                  {metrics.count12m > 0 && (
                    <span className="ml-1 text-[10px] text-gray-400">· {metrics.count12m} pagto(s)</span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {puMinValue == null && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
              PU mínimo indisponível: razão e classificação não puderam ser calculadas.
            </p>
          )}

          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Limites: &lt; 1,00% ruim · 1,00–1,20% regular · ≥ 1,20% excelente
          </p>
        </div>
      )}

      {/* Payment table */}
      {sortedPayments.length > 0 && (
        <div>
          <div className="flex items-center mb-1">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">{sortedPayments.length}</span>
              {' '}pagamento{sortedPayments.length > 1 ? 's' : ''} na agenda
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Data</th>
                <th className="px-2.5 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                <th className="px-2.5 py-1.5 text-right font-medium text-gray-500 dark:text-gray-400">Valor</th>
                <th className="px-2.5 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayments.map((event, idx) => (
                <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-2.5 py-1.5 text-gray-900 dark:text-gray-100 whitespace-nowrap">{event.date}</td>
                  <td className="px-2.5 py-1.5 text-gray-700 dark:text-gray-300">{event.type}</td>
                  <td className="px-2.5 py-1.5 text-gray-700 dark:text-gray-300 text-right whitespace-nowrap">
                    {event.rawValue
                      ? `R$ ${event.rawValue}`
                      : event.value != null
                        ? formatCurrencyExact(event.value)
                        : '—'}
                  </td>
                  <td className="px-2.5 py-1.5">
                    {event.status ? (
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        event.status.toLowerCase() === 'pago' || event.status.toLowerCase() === 'liquidado'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {event.status}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs de execução — auto-expandido durante o loading; colapsado após */}
      {scrapeLogs.length > 0 && (
        scrapingStatus === 'loading' ? (
          <div className="mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
              Log de execução ({scrapeLogs.length} linha{scrapeLogs.length > 1 ? 's' : ''})
            </p>
            <pre className="max-h-40 overflow-y-auto rounded-md bg-gray-900 dark:bg-black p-2 text-[10px] leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words">
              {scrapeLogs.join('\n')}
            </pre>
          </div>
        ) : (
          (scrapingStatus === 'error' || scrapingStatus === 'success' || scrapingStatus === 'empty') && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Ver log de execução ({scrapeLogs.length} linhas)
              </summary>
              <pre className="mt-1 max-h-40 overflow-y-auto rounded-md bg-gray-900 dark:bg-black p-2 text-[10px] leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words">
                {scrapeLogs.join('\n')}
              </pre>
            </details>
          )
        )
      )}
    </fieldset>
  );
}
