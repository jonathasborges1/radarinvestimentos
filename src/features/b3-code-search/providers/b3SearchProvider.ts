import type { B3SearchProvider, SearchHit } from '../types';
import { duckduckgoSearchProvider } from './duckduckgoSearchProvider';

/**
 * Busca restrita ao domínio b3.com.br via DDG. As páginas de instrumento
 * no site da B3 normalmente trazem o ticker no título e na URL, então
 * aumenta a chance de capturar o Código B3 no `candidates` da hit.
 */
export const b3SearchProvider: B3SearchProvider = {
  name: 'b3',
  search(query: string): Promise<SearchHit[]> {
    return duckduckgoSearchProvider.search(`site:b3.com.br ${query}`);
  },
};
