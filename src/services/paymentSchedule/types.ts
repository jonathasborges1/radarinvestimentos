/**
 * Tipos compartilhados pela camada de provedores de agente fiduciário.
 *
 * Mantemos `date` e `total` como strings: a data preserva o formato exibido
 * pelo agente (ex.: "15.04.2026") e o total preserva a precisão decimal
 * original (ex.: "12,41774000"). A conversão para número é feita apenas
 * para filtragem (TOTAL > 0).
 */
export type PaymentScheduleItem = {
  date: string;
  total: string;
};

export type PaymentScheduleAssetRef = {
  code: number | string;
  nickName: string;
  /**
   * Código de negociação (CETIP/B3) preenchido pelo usuário. Em muitos
   * agentes fiduciários a URL do histórico é construída a partir deste
   * código (e não do `code` numérico interno). Quando presente, deve
   * ter preferência para sintetizar URLs.
   */
  b3Code?: string;
};

export type FetchScheduleInput = {
  fiduciaryAgentUrl: string;
  asset: PaymentScheduleAssetRef;
};

export type PaymentScheduleProvider = {
  name: string;
  canHandle(input: FetchScheduleInput): boolean;
  fetchSchedule(input: FetchScheduleInput): Promise<PaymentScheduleItem[]>;
};

export type FetchScheduleSuccess = {
  ok: true;
  provider: string;
  items: PaymentScheduleItem[];
};

export type FetchScheduleFailure = {
  ok: false;
  provider?: string;
  /** True quando nenhum provider conhecido aceita a URL informada. */
  unsupported?: boolean;
  error: string;
};

export type FetchScheduleResult = FetchScheduleSuccess | FetchScheduleFailure;
