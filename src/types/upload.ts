import type { Asset } from './asset';

export interface AssetFieldChange {
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Mapa de alterações campo a campo para um ativo atualizado por upload.
 * Vive no próprio asset enquanto a alteração for relevante para
 * visualização. É limpo apenas em re-merges (ou via export, que
 * remove a metadata antes de serializar).
 */
export type AssetUpdatedFields = Record<string, AssetFieldChange>;

export type UploadAssetStatus = 'new' | 'updated' | 'unchanged';

export interface UploadAssetSummary {
  assetKey: string;
  nickName: string;
  maturityDate: string | null;
  indexers: string | null;
  status: UploadAssetStatus;
  changedFields?: AssetUpdatedFields;
}

/**
 * Registro persistido para cada arquivo .json importado pelo usuário.
 * Mantemos no máximo os últimos `MAX_UPLOAD_HISTORY` itens.
 */
export interface UploadHistoryItem {
  id: string;
  fileName: string;
  uploadedAt: string;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  originalJson: Asset[];
  changesSummary: UploadAssetSummary[];
}
