import type { PaymentEvent } from '../types';

const PROXY_URL = 'http://localhost:3001';

/**
 * Returns true if the app is running on localhost (dev environment).
 * The scraper feature is only available locally.
 */
export function isLocalhost(): boolean {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/**
 * Checks if the proxy scraper server is running.
 */
export async function isProxyAvailable(): Promise<boolean> {
  if (!isLocalhost()) return false;
  try {
    const response = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

export interface ScrapeResult {
  success: boolean;
  payments?: PaymentEvent[];
  source?: string;
  fetchedAt?: string;
  error?: string;
  logs?: string[];
}

/**
 * Calls the local proxy scraper to fetch payment schedule data.
 * Only works when running on localhost with the proxy server active.
 */
export async function fetchPaymentSchedule(url: string): Promise<ScrapeResult> {
  if (!isLocalhost()) {
    return { success: false, error: 'Funcionalidade disponível apenas em localhost.' };
  }

  try {
    const response = await fetch(`${PROXY_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      return { success: false, error: `Erro do proxy: HTTP ${response.status}` };
    }

    const data = await response.json();
    return data as ScrapeResult;
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, error: 'Timeout: o servidor demorou muito para responder.' };
    }
    if (err instanceof Error && err.message.includes('fetch')) {
      return { success: false, error: 'Proxy não disponível. Execute: node scripts/proxy-scraper.mjs' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido.' };
  }
}
