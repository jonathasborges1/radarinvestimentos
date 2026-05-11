import type { B3SearchProvider, SearchHit } from '../types';
import { duckduckgoSearchProvider } from './duckduckgoSearchProvider';

/**
 * Lista de domínios onde tipicamente encontramos a página de detalhe de
 * um CRA/CRI/Debênture — securitizadoras e agentes fiduciários. Esses
 * sites costumam estampar o código IF no título ou na URL da página,
 * tornando a extração direta de candidatos muito mais provável que em
 * portais genéricos.
 *
 * Para adicionar uma fonte: inclua o domínio aqui. Não há custo extra —
 * `site:` agrupa numa única query.
 */
export const SECURITIZADORAS_SITES = [
  'site:vortx.com.br',
  'site:pentagonotrustee.com.br',
  'site:oliveiratrust.com.br',
  'site:opea.com.br',
  'site:virgo.com.br',
  'site:simplific.com.br',
  'site:ecoagro.agr.br',
];

const SITE_RESTRICTION = `(${SECURITIZADORAS_SITES.join(' OR ')})`;

/**
 * Reusa o DuckDuckGo como motor — o que muda é o conjunto de domínios.
 * Trocar de motor (Bing/Brave) requer só editar este wrapper.
 */
export const securitizadorasSearchProvider: B3SearchProvider = {
  name: 'securitizadoras',
  search(query: string): Promise<SearchHit[]> {
    return duckduckgoSearchProvider.search(`${SITE_RESTRICTION} ${query}`);
  },
};
