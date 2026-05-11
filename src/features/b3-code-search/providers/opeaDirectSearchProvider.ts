import type { B3SearchProvider, SearchHit } from '../types';
import { fetchHtmlViaProxy } from '../../payment-schedule/fetchHtmlViaProxy';
import { extractB3Candidates } from '../scoring';

/**
 * Provider que busca diretamente no site da Opea.
 * A Opea lista emissÃµes com o cÃ³digo IF na URL e no corpo da pÃ¡gina.
 * 
 * EstratÃ©gia: busca na pÃ¡gina de listagem da Opea usando o nome do emissor.
 * Se encontrar links de emissÃµes, busca o detalhe para extrair o cÃ³digo.
 */

const OPEA_SEARCH_URL = 'https://app.opea.com.br/pt/emissoes';
const MAX_DETAIL_PAGES = 2;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai links de emissÃµes da pÃ¡gina da Opea.
 * Pattern: /pt/emissoes/{code}
 */
function extractOpeaEmissionLinks(html: string): string[] {
  const links: string[] = [];
  const pattern = /\/pt\/emissoes\/([A-Z0-9]{6,20})/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const code = match[1].toUpperCase();
    const url = `https://app.opea.com.br/pt/emissoes/${code}`;
    if (!links.includes(url)) links.push(url);
  }
  return links;
}

export const opeaDirectSearchProvider: B3SearchProvider = {
  name: 'opea-direto',
  async search(query: string): Promise<SearchHit[]> {
    // Try fetching the Opea search/listing page
    // Opea doesn't have a search endpoint, but we can try direct URL patterns
    // based on common code formats for CRA/CRI
    
    const hits: SearchHit[] = [];

    // Strategy 1: Try the main emissions page and look for matching links
    try {
      const html = await fetchHtmlViaProxy(OPEA_SEARCH_URL);
      const text = stripHtml(html);
      const emissionLinks = extractOpeaEmissionLinks(html);
      const codes = extractB3Candidates(text);

      if (codes.length > 0 || emissionLinks.length > 0) {
        hits.push({
          title: 'Opea - EmissÃµes',
          snippet: text.slice(0, 4000),
          url: OPEA_SEARCH_URL,
          candidates: codes,
        });
      }

      // Strategy 2: Try detail pages for emissions that match the query
      const queryUpper = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const relevantLinks = emissionLinks
        .filter(link => {
          const code = link.split('/').pop() || '';
          // Check if the code contains parts of the query
          return queryUpper.split(' ').some(part => 
            part.length > 2 && code.includes(part)
          );
        })
        .slice(0, MAX_DETAIL_PAGES);

      for (const detailUrl of relevantLinks) {
        try {
          const detailHtml = await fetchHtmlViaProxy(detailUrl);
          const detailText = stripHtml(detailHtml);
          const detailCodes = extractB3Candidates(detailText);
          const code = detailUrl.split('/').pop() || '';

          hits.push({
            title: `Opea - ${code}`,
            snippet: detailText.slice(0, 4000),
            url: detailUrl,
            candidates: detailCodes.length > 0 ? detailCodes : [code],
          });
        } catch {
          // Skip failed detail pages
        }
      }
    } catch {
      // Opea unavailable â€” skip silently
    }

    return hits;
  },
};

