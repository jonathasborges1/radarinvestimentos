export type Asset = {
  // Campos originais do JSON
  nickName: string;
  maturityDate: string | null;
  fee: string | null;
  minimumQuantityForApplication?: number | null;
  puMinValue?: number | null;
  product: string | null;
  qualifiedInvestor: "S" | "N" | string;
  professionalInvestor: "S" | "N" | string;
  generalInvestor: "S" | "N" | string;
  indexers: string | null;
  incentive: "S" | "N" | string;
  ratingName: string | null;
  agencyName: string | null;
  guaranteeFGC: boolean;
  redemptionType: string | null;
  code: number | string;
  quantityAvailable?: number | null;
  descriptionAmortization?: string | null;
  descriptionInterestrates?: string | null;
  graceDate?: string | null;
  riskScore?: number | null;
  prefixedFeeValue?: number | null;

  // Campos customizados (adicionados pelo usuário)
  b3Code?: string;
  fiduciaryAgentUrl?: string;
  notes?: string;
  favorite?: boolean;
  tags?: string[];
  trackingStatus?: "not_started" | "watching" | "completed" | "ignored";
  paymentSchedule?: PaymentEvent[];
  paymentScheduleUpdatedAt?: string;

  // Metadata de import incremental (gerada pela aplicação,
  // não vem do .json original). Removida no export.
  updatedFields?: Record<string, { oldValue: unknown; newValue: unknown }>;
  hasUnreadChanges?: boolean;
};

export interface PaymentEvent {
  date: string;
  type: string; // "Juros", "Amortização", "Juros + Amortização", etc.
  value?: number | null;
  status?: string; // "Pago", "Previsto", etc.
  /**
   * Valor original como string, preservando a precisão decimal exibida pelo
   * agente fiduciário (ex.: "12,41774000"). Quando presente, a UI deve usar
   * este campo em vez de formatar `value`.
   */
  rawValue?: string;
}

export interface AssetFile {
  data: Asset[];
}
