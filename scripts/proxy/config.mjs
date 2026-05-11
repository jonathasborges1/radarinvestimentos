export const PORT = 3001;
export const HOST = '127.0.0.1';
export const ALLOWED_ORIGIN = 'http://localhost:5173';
export const FETCH_HTML_TIMEOUT_MS = 15000;
export const FETCH_HTML_CACHE_TTL_MS = 5 * 60 * 1000;
export const FETCH_HTML_FAILURE_CACHE_TTL_MS = 30 * 1000;
export const FETCH_HTML_CACHE_MAX_ITEMS = 250;

export const HTML_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

export const JSON_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};
