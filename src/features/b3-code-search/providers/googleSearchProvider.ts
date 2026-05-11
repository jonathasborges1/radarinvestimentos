import type { B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';

/**
 * Google HTML SERP â€” busca genÃ©rica via Google. Usa o endpoint de busca
 * padrÃ£o com parÃ¢metros para resultados em portuguÃªs do Brasil.
 * 
 * LimitaÃ§Ã£o: Google pode servir CAPTCHA ou bloquear apÃ³s muitas
 * requisiÃ§Ãµes. Usado como fallback quando DDG/Bing falham.
 */

export function buildGoogleUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: 'pt-BR',
    gl: 'BR',
    num: '10',
  });
  return `https://www.google.com/search?${params.toString()}`;
}

export function parseGoogleHtml(html: string): SearchHit[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  // Google result containers
  const containers = doc.querySelectorAll('div.g, div[data-sokoban-container]');

  containers.forEach(container => {
    const linkEl = container.querySelector<HTMLAnchorElement>('a[href^="http"]');
    if (!linkEl) return;

    const url = linkEl.getAttribute('href') || '';
    if (!url || seen.has(url)) return;
    // Skip Google's own links
    if (url.includes('google.com') || url.includes('accounts.google')) return;
    seen.add(url);

    const titleEl = container.querySelector('h3');
    const title = (titleEl?.textContent || linkEl.textContent || '').trim();

    const snippetEl = container.querySelector(
      'div[data-sncf], div.VwiC3b, span.aCOpRe, div[style*="-webkit-line-clamp"]'
    );
    const snippet = (snippetEl?.textContent || '').trim();

    if (title) {
      hits.push({
        title,
        url,
        snippet,
        candidates: extractB3Candidates(`${title} ${snippet} ${url}`),
      });
    }
  });

  // Fallback: try to extract from cite elements (simpler structure)
  if (hits.length === 0) {
    const links = doc.querySelectorAll<HTMLAnchorElement>('a[href^="http"]');
    links.forEach(link => {
      const url = link.getAttribute('href') || '';
      if (!url || seen.has(url)) return;
      if (url.includes('google.com')) return;
      seen.add(url);

      const title = (link.textContent || '').trim();
      if (title && title.length > 5) {
        hits.push({
          title,
          url,
          snippet: '',
          candidates: extractB3Candidates(`${title} ${url}`),
        });
      }
    });
  }

  return hits;
}

export const googleSearchProvider: B3SearchProvider = {
  name: 'google',
  async search(query: string): Promise<SearchHit[]> {
    const html = await fetchHtmlViaProxy(buildGoogleUrl(query));
    return parseGoogleHtml(html);
  },
};

