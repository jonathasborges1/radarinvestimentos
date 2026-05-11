import type { B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';

/**
 * DuckDuckGo HTML SERP â€” endpoint no-JS que devolve o HTML pronto para
 * parse com DOMParser. Sem API key, sem rate-limit declarado, com bom
 * comportamento sob o User-Agent de Chrome usado pelo proxy local.
 *
 * LimitaÃ§Ã£o real: DDG pode servir pÃ¡gina intermediÃ¡ria ("redirecionando
 * em N segundos") em alguns User-Agents â€” a heurÃ­stica do parser
 * tolera ausÃªncia de resultados retornando lista vazia, e o caller
 * apenas registra "0 resultados" no log.
 */
const ENDPOINT = 'https://html.duckduckgo.com/html/';

export function buildDuckDuckGoUrl(query: string): string {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&kl=br-pt`;
}

/**
 * Decodifica o wrapper `https://duckduckgo.com/l/?uddg=â€¦` que o DDG usa
 * em alguns resultados. Quando o href jÃ¡ Ã© direto, devolve sem mexer.
 */
export function unwrapDuckUrl(href: string): string {
  if (!href) return href;
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    if (u.hostname.includes('duckduckgo.com') && u.pathname === '/l/') {
      const real = u.searchParams.get('uddg');
      if (real) return decodeURIComponent(real);
    }
    return u.toString();
  } catch {
    return href;
  }
}

/**
 * Parser tolerante: a marcaÃ§Ã£o do DDG mudou algumas vezes â€” usamos um
 * conjunto de seletores comuns e deduplicamos por URL final.
 */
export function parseDuckDuckGoHtml(html: string): SearchHit[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll(
    '.result.results_links, .web-result, .result, div[data-testid="result"]',
  );
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  nodes.forEach(node => {
    const titleEl = node.querySelector<HTMLAnchorElement>(
      'a.result__a, h2 a, a[data-testid="result-title-a"]',
    );
    if (!titleEl) return;
    const title = (titleEl.textContent || '').trim();
    const href = titleEl.getAttribute('href') || '';
    const url = unwrapDuckUrl(href);
    if (!title || !url) return;
    if (seen.has(url)) return;
    seen.add(url);

    const snippetEl = node.querySelector(
      '.result__snippet, .result__body, [data-testid="result-snippet"]',
    );
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

export const duckduckgoSearchProvider: B3SearchProvider = {
  name: 'duckduckgo',
  async search(query: string): Promise<SearchHit[]> {
    const html = await fetchHtmlViaProxy(buildDuckDuckGoUrl(query));
    return parseDuckDuckGoHtml(html);
  },
};

