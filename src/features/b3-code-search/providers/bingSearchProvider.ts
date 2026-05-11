import type { B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';

/**
 * Bing HTML SERP â€” alternativa robusta ao DDG. Em geral devolve mais
 * resultados orgÃ¢nicos e tolera melhor o User-Agent de Chrome usado pelo
 * proxy. Mantemos o DDG como primeiro provedor por ser mais previsÃ­vel
 * em consultas com `site:`, e o Bing como rede de seguranÃ§a.
 */
const ENDPOINT = 'https://www.bing.com/search';

export function buildBingUrl(query: string): string {
  return `${ENDPOINT}?q=${encodeURIComponent(query)}&setlang=pt-br&cc=BR`;
}

/**
 * Marcas-padrÃ£o do Bing para resultados orgÃ¢nicos:
 *   <li class="b_algo">
 *     <h2><a href="â€¦">TÃ­tulo</a></h2>
 *     <p>â€¦ snippet â€¦</p>
 *   </li>
 *
 * O parser tolera variaÃ§Ãµes de markup e ignora resultados patrocinados
 * (`b_ad`).
 */
export function parseBingHtml(html: string): SearchHit[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = doc.querySelectorAll('li.b_algo, ol#b_results > li:not(.b_ad)');
  const seen = new Set<string>();
  const hits: SearchHit[] = [];

  nodes.forEach(node => {
    const titleEl = node.querySelector<HTMLAnchorElement>('h2 a, .b_algo a[href^="http"]');
    if (!titleEl) return;
    const title = (titleEl.textContent || '').trim();
    const url = titleEl.getAttribute('href') || '';
    if (!title || !url || !/^https?:/i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);

    const snippetEl =
      node.querySelector('.b_caption p') ||
      node.querySelector('p') ||
      node.querySelector('.b_snippet');
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

export const bingSearchProvider: B3SearchProvider = {
  name: 'bing',
  async search(query: string): Promise<SearchHit[]> {
    const html = await fetchHtmlViaProxy(buildBingUrl(query));
    return parseBingHtml(html);
  },
};

