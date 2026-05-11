/**
 * Cliente HTTP para o proxy local (`scripts/proxy-scraper.mjs`).
 *
 * O endpoint `/fetch-html` apenas obtém o HTML cru de uma URL pública,
 * contornando CORS. Todo o parsing acontece no browser, no provider
 * apropriado, mantendo a regra de cada agente fiduciário em um único lugar.
 *
 * Disponível somente em localhost.
 */
const PROXY_URL = 'http://localhost:3001';
const DEFAULT_TIMEOUT_MS = 30_000;

export class ProxyUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      'Proxy local indisponível. Execute em outro terminal: node scripts/proxy-scraper.mjs',
      options,
    );
    this.name = 'ProxyUnavailableError';
  }
}

export interface FetchHtmlResult {
  html: string;
  cached: boolean;
}

export async function fetchHtmlViaProxy(url: string): Promise<string> {
  const result = await fetchHtmlViaProxyDetailed(url);
  return result.html;
}

/**
 * Detailed version that also returns cache status.
 */
export async function fetchHtmlViaProxyDetailed(url: string): Promise<FetchHtmlResult> {
  let response: Response;
  try {
    response = await fetch(`${PROXY_URL}/fetch-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Timeout ao buscar a página remota via proxy.', { cause: err });
    }
    throw new ProxyUnavailableError({ cause: err });
  }

  // HTTP 400 = client error (invalid URL)
  // HTTP 500 = proxy internal bug
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(
      (data as { error?: string }).error || `Proxy retornou HTTP ${response.status}.`,
    );
  }

  // HTTP 200 — parse the JSON payload
  const data = (await response.json()) as
    | { ok: true; status: number; html: string; cached?: boolean }
    | { ok: false; error: string; status?: number };

  if (!data.ok) {
    // Upstream failure reported gracefully by proxy (not a proxy bug)
    const status = 'status' in data && data.status ? ` (HTTP ${data.status})` : '';
    throw new Error(`${data.error || 'Falha ao buscar a página remota'}${status}`);
  }

  return { html: data.html, cached: data.cached ?? false };
}
