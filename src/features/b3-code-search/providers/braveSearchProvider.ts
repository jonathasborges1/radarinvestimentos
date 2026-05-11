import type { B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';

/**
 * Brave Search â€” Ã­ndice independente (nÃ£o derivado de Google/Bing),
 * com bom suporte a scraping via User-Agent de Chrome. Usado como rede
 * de seguranÃ§a adicional quando DDG e Bing devolvem 0 hits.
 */
const ENDPOINT = 'https://search.brave.com/search';

export function buildBraveUrl(query: string): string {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&source=web&country=br`;
}

/**
 * Parser permissivo: a marcaÃ§Ã£o do Brave jÃ¡ mudou vÃ¡rias vezes â€” testamos
 * mÃºltiplos seletores e deduplicamos por URL final.
 */
export function parseBraveHtml(html: string): SearchHit[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll(
    'div.snippet, div[data-type="web"], #results div.snippet, .fdb',
  );
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  nodes.forEach(node => {
    const titleEl = node.querySelector<HTMLAnchorElement>(
      'a.h, a.snippet-title, a.result-header, a[href^="http"]',
    );
    if (!titleEl) return;
    const title = (titleEl.textContent || '').trim();
    const url = titleEl.getAttribute('href') || '';
    if (!title || !url || !/^https?:/i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);

    const snippetEl =
      node.querySelector('.snippet-description') ||
      node.querySelector('.snippet-content') ||
      node.querySelector('p');
    const snippet = (snippetEl?.textContent || '').trim();

    hits.push({
      title,
      url,
      snippet,
      candidates: extractB3Candidates(`${title} ${snippet} ${url}`),
    });
  });

  return hits;
}

export const braveSearchProvider: B3SearchProvider = {
  name: 'brave',
  async search(query: string): Promise<SearchHit[]> {
    const html = await fetchHtmlViaProxy(buildBraveUrl(query));
    return parseBraveHtml(html);
  },
};

