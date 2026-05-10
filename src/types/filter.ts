export interface FilterState {
  search: string;
  product: string[];
  indexer: string[];
  rating: string[];
  agency: string[];
  interestFrequency: string[];
  amortizationFrequency: string[];
  qualifiedInvestor: boolean | null;
  professionalInvestor: boolean | null;
  generalInvestor: boolean | null;
  incentive: boolean | null;
  guaranteeFGC: boolean | null;
  maturityDateStart: string | null;
  maturityDateEnd: string | null;
  feeMin: number | null;
  feeMax: number | null;
  riskMin: number | null;
  riskMax: number | null;
}

export interface FilterOptions {
  products: string[];
  indexers: string[];
  ratings: string[];
  agencies: string[];
  interestFrequencies: string[];
  amortizationFrequencies: string[];
}
