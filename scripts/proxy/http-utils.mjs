import {
  FETCH_HTML_CACHE_TTL_MS,
  FETCH_HTML_FAILURE_CACHE_TTL_MS,
  FETCH_HTML_CACHE_MAX_ITEMS,
} from './config.mjs';

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido.', { cause: err }));
      }
    });

    req.on('error', reject);
  });
}

export function parseHttpUrl(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, error: 'URL é obrigatória.' };
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Apenas http(s) é suportado.' };
    }

    return { ok: true, url };
  } catch {
    return { ok: false, error: 'URL inválida.' };
  }
}

/* ------------------------------------------------------------------ */
/*  In-memory cache for /fetch-html                                     */
/* ------------------------------------------------------------------ */

const cache = new Map(); // key: url string → { html, status, timestamp }

/**
 * Returns cached entry if valid, or null.
 */
export function cacheGet(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  const ttl = entry.ok ? FETCH_HTML_CACHE_TTL_MS : FETCH_HTML_FAILURE_CACHE_TTL_MS;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(url);
    return null;
  }
  return entry;
}

/**
 * Stores a successful response in cache.
 * Only caches non-empty HTML with ok status.
 */
export function cacheSet(url, status, html) {
  if (!html || html.length === 0) return;
  if (status < 200 || status >= 400) return;

  // Evict oldest entries if at capacity
  if (cache.size >= FETCH_HTML_CACHE_MAX_ITEMS) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  cache.set(url, { ok: true, html, status, timestamp: Date.now() });
}

/**
 * Stores an expected upstream failure for a short period.
 */
export function cacheFailure(url, status, error) {
  if (!error) return;

  if (cache.size >= FETCH_HTML_CACHE_MAX_ITEMS) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  cache.set(url, { ok: false, status, error, timestamp: Date.now() });
}

/**
 * Returns true if the error is an expected upstream failure
 * (timeout, DNS, connection reset, etc.) — NOT a proxy bug.
 */
export function isUpstreamError(err) {
  if (!err) return false;
  const name = err.name || '';
  const msg = (err.message || '').toLowerCase();
  const code = err.cause?.code || err.code || '';
  const causeMsg = (err.cause?.message || '').toLowerCase();

  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'EPIPE' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET' ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('dns') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('unable to connect') ||
    msg.includes('aborted') ||
    causeMsg.includes('econnrefused') ||
    causeMsg.includes('econnreset') ||
    causeMsg.includes('enotfound') ||
    causeMsg.includes('timeout') ||
    causeMsg.includes('socket hang up')
  );
}
