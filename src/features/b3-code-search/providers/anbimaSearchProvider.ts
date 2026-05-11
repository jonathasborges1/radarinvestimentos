import type { B3SearchProvider, SearchHit } from '../types';
import { duckduckgoSearchProvider } from './duckduckgoSearchProvider';

/**
 * Busca restrita ao domínio anbima.com.br via DDG. Útil para CRAs/CRIs
 * cadastrados no portal de dados da Anbima — a URL costuma conter o
 * código IF do ativo.
 */
export const anbimaSearchProvider: B3SearchProvider = {
  name: 'anbima',
  search(query: string): Promise<SearchHit[]> {
    return duckduckgoSearchProvider.search(
      `(site:anbima.com.br OR site:data.anbima.com.br) ${query}`,
    );
  },
};
