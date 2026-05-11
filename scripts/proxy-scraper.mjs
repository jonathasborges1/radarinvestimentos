/**
 * Proxy Scraper Server - YieldRadar
 *
 * Servidor local que busca dados de agenda de pagamento de agentes fiduciários.
 * Roda apenas em localhost:3001.
 *
 * Uso: node scripts/proxy-scraper.mjs
 */

import http from 'node:http';
import {
  ALLOWED_ORIGIN,
  FETCH_HTML_TIMEOUT_MS,
  HTML_FETCH_HEADERS,
  HOST,
  PORT,
} from './proxy/config.mjs';
import {
  cacheFailure,
  cacheGet,
  cacheSet,
  isUpstreamError,
  parseHttpUrl,
  readJsonBody,
  sendJson,
} from './proxy/http-utils.mjs';
import { scrapePayments } from './scrapers/index.mjs';

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/scrape') {
    await handleScrape(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/fetch-html') {
    await handleFetchHtml(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🔍 YieldRadar Proxy Scraper rodando em http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log('   POST /scrape      - { "url": "..." } (legado: parse no Node)');
  console.log('   POST /fetch-html  - { "url": "..." } (devolve HTML cru)');
  console.log('   GET  /health      - Status do servidor\n');
});

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handleScrape(req, res) {
  try {
    const { url } = await readJsonBody(req);
    const parsed = parseHttpUrl(url);
    if (!parsed.ok) {
      sendJson(res, 400, { success: false, error: parsed.error, logs: [] });
      return;
    }

    console.log(`\n[scrape] Buscando: ${parsed.url}`);
    const result = await scrapePayments(parsed.url);
    logScrapeResult(result);

    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, {
      success: false,
      error: err.message,
      logs: [`[server] Erro: ${err.message}`],
    });
  }
}

/**
 * /fetch-html — fetches a remote URL and returns the HTML.
 *
 * Response contract:
 * - HTTP 400: invalid URL or unsupported protocol (client error)
 * - HTTP 200 + { ok: true, status, html, cached }: successful fetch
 * - HTTP 200 + { ok: false, error, status? }: expected upstream failure
 *   (timeout, DNS, connection reset, HTTP 4xx/5xx from remote)
 * - HTTP 500: unexpected proxy-internal error (bug)
 */
async function handleFetchHtml(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
    return;
  }

  const parsed = parseHttpUrl(body.url);
  if (!parsed.ok) {
    sendJson(res, 400, { ok: false, error: parsed.error });
    return;
  }

  const urlStr = parsed.url.toString();

  // Check cache first
  const cached = cacheGet(urlStr);
  if (cached) {
    if (cached.ok) {
      console.log(`[fetch-html] CACHE HIT: ${urlStr} (${cached.html.length}b)`);
      sendJson(res, 200, { ok: true, status: cached.status, html: cached.html, cached: true });
      return;
    }

    console.log(`[fetch-html] CACHE HIT failure: ${cached.error} - ${urlStr}`);
    sendJson(res, 200, {
      ok: false,
      error: cached.error,
      status: cached.status,
      cached: true,
    });
    return;
  }

  // Fetch from upstream
  try {
    const upstream = await fetch(urlStr, {
      headers: HTML_FETCH_HEADERS,
      signal: AbortSignal.timeout(FETCH_HTML_TIMEOUT_MS),
      redirect: 'follow',
    });

    if (!upstream.ok) {
      const error = `Upstream HTTP ${upstream.status}`;
      console.log(`[fetch-html] HTTP ${upstream.status} - ${urlStr}`);
      cacheFailure(urlStr, upstream.status, error);
      sendJson(res, 200, {
        ok: false,
        error,
        status: upstream.status,
      });
      return;
    }

    const html = await upstream.text();
    console.log(`[fetch-html] HTTP ${upstream.status} - ${html.length}b - ${urlStr}`);

    cacheSet(urlStr, upstream.status, html);
    sendJson(res, 200, { ok: true, status: upstream.status, html, cached: false });
  } catch (err) {
    // Extract the real cause — Node's fetch wraps network errors
    const cause = err.cause;
    const causeCode = cause?.code || '';
    const causeMsg = cause?.message || '';
    const errMsg = err.message || 'Erro desconhecido';
    const detail = causeCode
      ? `${errMsg} (${causeCode}: ${causeMsg})`
      : causeMsg && causeMsg !== errMsg
        ? `${errMsg} (${causeMsg})`
        : errMsg;

    if (isUpstreamError(err)) {
      // Expected upstream failure — log as warning, not error
      console.log(`[fetch-html] ⚠ upstream falhou: ${detail} - ${urlStr}`);
      cacheFailure(urlStr, undefined, detail);
      sendJson(res, 200, { ok: false, error: detail });
    } else {
      // Unexpected proxy-internal error — this is a bug
      console.error(`[fetch-html] ❌ ERRO INTERNO:`, err);
      sendJson(res, 500, { ok: false, error: `Erro interno do proxy: ${detail}` });
    }
  }
}

function logScrapeResult(result) {
  const summary = result.success
    ? `${result.payments?.length || 0} eventos`
    : result.error;

  console.log(`[scrape] Resultado: ${summary}`);

  for (const log of result.logs || []) {
    console.log(`  ${log}`);
  }
}
