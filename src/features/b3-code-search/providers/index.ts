import type { B3SearchProvider } from '../types';
import { anbimaSearchProvider } from './anbimaSearchProvider';
import { b3SearchProvider } from './b3SearchProvider';
import { bingSearchProvider } from './bingSearchProvider';
import { braveSearchProvider } from './braveSearchProvider';
import { duckduckgoSearchProvider } from './duckduckgoSearchProvider';
import { googleSearchProvider } from './googleSearchProvider';
import { opeaDirectSearchProvider } from './opeaDirectSearchProvider';
import { securitizadorasSearchProvider } from './securitizadorasSearchProvider';
import { vortxDirectSearchProvider } from './vortxDirectSearchProvider';

/**
 * Lista padrão de provedores de busca, em ordem de execução. A ordem
 * importa: provedores mais específicos primeiro maximiza a chance de
 * encontrar a página oficial cedo (e abortar antes de queries genéricas
 * que produzem ruído). Para adicionar uma fonte:
 *   1. Crie `src/features/b3-code-search/providers/<nome>SearchProvider.ts`
 *      implementando `B3SearchProvider`.
 *   2. Importe e registre aqui.
 *
 * Ordem atual:
 *   1. vortx-direto — busca direta no site da Vórtx.
 *   2. opea-direto — busca direta no site da Opea.
 *   3. securitizadoras — agentes fiduciários via DDG (site:).
 *   4. b3 — site oficial; útil quando indexado.
 *   5. anbima — portal de dados; útil para CRAs/CRIs cadastrados.
 *   6. google — busca genérica, mais estável que DDG.
 *   7. duckduckgo — busca genérica, sem restrição.
 *   8. bing — rede de segurança quando DDG bloqueia.
 *   9. brave — índice independente, último recurso.
 */
export const b3SearchProviders: B3SearchProvider[] = [
  vortxDirectSearchProvider,
  opeaDirectSearchProvider,
  securitizadorasSearchProvider,
  b3SearchProvider,
  anbimaSearchProvider,
  googleSearchProvider,
  duckduckgoSearchProvider,
  bingSearchProvider,
  braveSearchProvider,
];

export {
  anbimaSearchProvider,
  b3SearchProvider,
  bingSearchProvider,
  braveSearchProvider,
  duckduckgoSearchProvider,
  googleSearchProvider,
  opeaDirectSearchProvider,
  securitizadorasSearchProvider,
  vortxDirectSearchProvider,
};
