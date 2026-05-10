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

export async function fetchHtmlViaProxy(url: string): Promise<string> {
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

  if (!response.ok) {
    throw new Error(`Proxy retornou HTTP ${response.status}.`);
  }

  const data = (await response.json()) as
    | { ok: true; status: number; html: string }
    | { ok: false; error: string; status?: number };

  if (!data.ok) {
    const status = 'status' in data && data.status ? ` (HTTP ${data.status})` : '';
    throw new Error(`${data.error || 'Falha ao buscar a página remota'}${status}`);
  }

  return data.html;
}
