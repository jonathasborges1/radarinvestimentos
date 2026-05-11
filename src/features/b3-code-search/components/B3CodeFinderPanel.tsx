import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset } from '../../../types';
import { findB3Code } from '../index';
import type { AssetB3MatchResult } from '../index';

interface B3CodeFinderPanelProps {
  asset: Asset;
  /**
   * Disparado quando o usuário aceita um candidato. Apenas atualiza o
   * input — a persistência continua acontecendo no "Salvar" do modal,
   * preservando o fluxo de confirmação manual.
   */
  onAccept: (b3Code: string) => void;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

const STATUS_LABEL: Record<NonNullable<AssetB3MatchResult['status']>, string> = {
  FOUND: 'Encontrado',
  LOW_CONFIDENCE: 'Baixa confiança',
  NOT_FOUND: 'Não encontrado',
};

const STATUS_CLASS: Record<NonNullable<AssetB3MatchResult['status']>, string> = {
  FOUND: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  LOW_CONFIDENCE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  NOT_FOUND: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

function formatConfidence(c: number | undefined): string {
  if (c == null) return '—';
  return `${c.toFixed(0)}/100`;
}

function getReasons(result: AssetB3MatchResult): string[] {
  const reasons = result.comparedData?.reasons;
  return Array.isArray(reasons) ? reasons.filter((reason): reason is string => typeof reason === 'string') : [];
}

/**
 * Heurística leve para detectar a causa-raiz mais comum de um NOT_FOUND:
 * o proxy local não está rodando. Se identificarmos sinais nos logs,
 * mostramos a instrução exata para o usuário.
 */
function ProxyHint({ logs }: { logs: string[] }) {
  const proxyDown = logs.some(l =>
    /proxy local indispon|TODOS os providers falharam|fetch failed|ECONNREFUSED/i.test(l),
  );
  if (!proxyDown) return null;
  return (
    <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-800 dark:text-amber-200">
      <p className="font-medium">Proxy local parece estar fora.</p>
      <p>
        Em outro terminal, rode:
        {' '}
        <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">node scripts/proxy-scraper.mjs</code>
      </p>
    </div>
  );
}

/**
 * Painel inline (logo abaixo do input "Código B3") que tenta localizar
 * o ticker do ativo via busca web e exibe o melhor candidato com sua
 * confiança. O usuário decide manualmente se aceita.
 */
export function B3CodeFinderPanel({ asset, onAccept }: B3CodeFinderPanelProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AssetB3MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const liveLogBoxRef = useRef<HTMLPreElement>(null);
  const resultLogBoxRef = useRef<HTMLPreElement>(null);

  const handleSearch = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setResult(null);
    setLiveLogs([]);
    try {
      const r = await findB3Code(
        {
          nickName: asset.nickName,
          product: asset.product,
          maturityDate: asset.maturityDate,
          fee: asset.fee,
          indexers: asset.indexers,
          ratingName: asset.ratingName,
          agencyName: asset.agencyName,
          fiduciaryAgentUrls: asset.fiduciaryAgentUrls,
          descriptionInterestrates: asset.descriptionInterestrates,
        },
        {
          onLog: line => {
            setLiveLogs(prev => [...prev, line]);
          },
        },
      );
      setResult(r);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.');
      setStatus('error');
    }
  }, [asset]);

  const logBoxClass =
    'mt-1 max-h-40 max-w-full overflow-x-auto overflow-y-auto rounded-md bg-gray-900 dark:bg-black p-2 text-[10px] leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-all';

  useEffect(() => {
    const logBox = liveLogBoxRef.current;
    if (logBox) logBox.scrollTop = logBox.scrollHeight;
  }, [liveLogs]);

  useEffect(() => {
    const logBox = resultLogBoxRef.current;
    if (logBox) logBox.scrollTop = logBox.scrollHeight;
  }, [result?.logs]);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-2 flex-wrap">
        <p className="min-w-0 text-xs font-semibold text-gray-700 dark:text-gray-200">
          Localizar Código B3 automaticamente
        </p>
        <button
          type="button"
          onClick={handleSearch}
          disabled={status === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? (
            <>
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Buscando...
            </>
          ) : (
            'Buscar via web'
          )}
        </button>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        Cruza nome, produto, vencimento, taxa, rating e agência em fontes públicas
        (B3, ANBIMA, DDG). Use apenas como sugestão — confirme manualmente antes de salvar.
      </p>

      {status === 'error' && error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {status === 'loading' && liveLogs.length > 0 && (
        <details open className="min-w-0 max-w-full overflow-x-hidden">
          <summary className="text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            Log de execução ({liveLogs.length} linhas)
          </summary>
          <pre ref={liveLogBoxRef} className={logBoxClass}>
            {liveLogs.join('\n')}
          </pre>
        </details>
      )}

      {status === 'done' && result && (
        <div className="min-w-0 max-w-full overflow-x-hidden space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[result.status]}`}>
              {STATUS_LABEL[result.status]}
            </span>
            {result.confidence != null && (
              <span className="text-[10px] text-gray-600 dark:text-gray-400">
                confiança {formatConfidence(result.confidence)}
              </span>
            )}
          </div>

          {result.b3Code && (
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                {result.b3Code}
              </code>
              <button
                type="button"
                onClick={() => onAccept(result.b3Code as string)}
                className="inline-flex items-center rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-[10px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                Aceitar candidato
              </button>
            </div>
          )}

          {result.sourceUrl && (
            <p className="text-[10px] break-all">
              <span className="text-gray-500 dark:text-gray-400">fonte: </span>
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {result.sourceUrl}
              </a>
            </p>
          )}

          {getReasons(result).length > 0 && (
            <p className="text-[10px] text-gray-600 dark:text-gray-300">
              justificativa: {getReasons(result).join('; ')}
            </p>
          )}

          {result.alternatives && result.alternatives.length > 0 && (
            <details>
              <summary className="text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                {result.alternatives.length} alternativa(s) com confiança menor
              </summary>
              <ul className="mt-1 min-w-0 space-y-1">
                {result.alternatives.map(alt => (
                  <li key={alt.b3Code} className="flex min-w-0 items-center gap-2 flex-wrap text-[10px] text-gray-700 dark:text-gray-200">
                    <code className="font-mono bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                      {alt.b3Code}
                    </code>
                    <span className="text-gray-600 dark:text-gray-300">
                      {formatConfidence(alt.confidence)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAccept(alt.b3Code)}
                      className="font-medium text-blue-600 dark:text-blue-300 hover:underline"
                    >
                      aceitar
                    </button>
                    <a
                      href={alt.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-w-0 max-w-full break-all text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-300 hover:underline sm:max-w-[200px] sm:truncate"
                    >
                      {alt.sourceUrl}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.status === 'NOT_FOUND' && (
            <>
              <p className="text-[10px] text-gray-600 dark:text-gray-300">
                NÃ£o foi possÃ­vel localizar o cÃ³digo B3 com confianÃ§a suficiente.
              </p>
              <ProxyHint logs={result.logs} />
            </>
          )}

          {result.logs.length > 0 && (
            <details open={result.status === 'NOT_FOUND' || result.status === 'LOW_CONFIDENCE'} className="min-w-0 max-w-full overflow-x-hidden">
              <summary className="text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Log de execução ({result.logs.length} linhas)
              </summary>
              <pre ref={resultLogBoxRef} className={logBoxClass}>
                {result.logs.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
