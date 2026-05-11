/**
 * Tipos compartilhados pela camada de busca de Código B3.
 *
 * Espelha o padrão de `src/services/paymentSchedule/types.ts`: orquestrador
 * desacoplado dos providers, providers expõem apenas `name` + uma função
 * pura de busca, e o resultado final é um objeto serializável com logs.
 */

export type AssetB3MatchStatus = 'FOUND' | 'NOT_FOUND' | 'LOW_CONFIDENCE';

/**
 * Subconjunto de `Asset` necessário para a busca. Mantemos próprio em vez
 * de receber um `Asset` inteiro para que o serviço possa ser exercitado em
 * testes sem montar um ativo completo.
 */
export interface AssetB3FinderInput {
  nickName: string;
  product?: string | null;
  maturityDate?: string | null;
  fee?: string | null;
  indexers?: string | null;
  ratingName?: string | null;
  agencyName?: string | null;
  fiduciaryAgentUrls?: string[] | null;
  descriptionInterestrates?: string | null;
}

export interface SearchHit {
  title: string;
  snippet: string;
  url: string;
  /** Códigos B3 candidatos extraídos do título/snippet/URL. */
  candidates: string[];
}

export interface B3SearchProvider {
  name: string;
  /**
   * Roda uma única estratégia de busca. O service é responsável por
   * ordenar/encadear chamadas; o provider só executa a query.
   */
  search(query: string): Promise<SearchHit[]>;
  /**
   * Quando implementado, o service chama este método UMA VEZ antes do
   * loop de queries genéricas. O provider gera suas próprias queries
   * otimizadas para a fonte específica e retorna todos os hits de uma vez.
   *
   * Providers com `searchAll` ainda participam do loop genérico via
   * `search()` — mas o `searchAll` roda primeiro e pode produzir
   * candidatos suficientes para encerrar a busca antecipadamente.
   */
  searchAll?: (input: AssetB3FinderInput) => Promise<SearchHit[]>;
}

export interface AssetB3MatchCandidate {
  b3Code: string;
  confidence: number;
  sourceUrl: string;
  comparedData: Record<string, unknown>;
}

export interface AssetB3MatchResult {
  success: boolean;
  status: AssetB3MatchStatus;
  b3Code?: string;
  confidence?: number;
  sourceUrl?: string;
  comparedData?: Record<string, unknown>;
  /**
   * Top candidatos descartados (úteis para a UI mostrar alternativas
   * abaixo do limiar de confiança).
   */
  alternatives?: AssetB3MatchCandidate[];
  logs: string[];
}
