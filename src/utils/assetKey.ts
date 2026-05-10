import type { Asset } from '../types';
import type {
  AssetUpdatedFields,
  UploadAssetSummary,
  UploadHistoryItem,
} from '../types/upload';

/**
 * Campos editados manualmente pelo usuário. Devem ser preservados ao
 * mesclar um ativo recebido via importação com um ativo já existente.
 */
export const MANUAL_FIELDS = [
  'b3Code',
  'fiduciaryAgentUrl',
  'notes',
  'favorite',
  'tags',
  'trackingStatus',
] as const;

export type ManualField = (typeof MANUAL_FIELDS)[number];

/**
 * Campos de metadata da própria aplicação. Não devem ser comparados
 * para detectar mudanças nem persistidos no export final.
 */
export const META_FIELDS = ['updatedFields', 'hasUnreadChanges'] as const;
export type MetaField = (typeof META_FIELDS)[number];

const IGNORED_FOR_DIFF = new Set<string>([...MANUAL_FIELDS, ...META_FIELDS]);

/** Limite máximo de uploads mantidos no histórico. */
export const MAX_UPLOAD_HISTORY = 30;

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeMaturityDate(value: Asset['maturityDate']): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return normalizeText(value);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Gera uma chave única e estável para identificar um ativo a partir
 * da combinação `nickName + maturityDate + indexers`. Dois ativos com
 * a mesma chave são considerados o mesmo registro.
 *
 * Normalizações aplicadas:
 * - texto: trim, colapsa espaços internos, uppercase;
 * - data: parse ISO/Date e reduz para `YYYY-MM-DD`.
 */
export function getAssetKey(
  asset: Pick<Asset, 'nickName' | 'maturityDate' | 'indexers'>
): string {
  const nickName = normalizeText(asset.nickName);
  const maturityDate = normalizeMaturityDate(asset.maturityDate);
  const indexers = normalizeText(asset.indexers);
  return `${nickName}|${maturityDate}|${indexers}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Compara dois ativos campo a campo e retorna um mapa apenas dos
 * campos cujo valor mudou. Campos manuais (preenchidos pelo usuário)
 * e meta (`updatedFields`, `hasUnreadChanges`) são ignorados.
 */
export function getChangedFields(oldAsset: Asset, newAsset: Asset): AssetUpdatedFields {
  const changes: AssetUpdatedFields = {};
  const oldRecord = oldAsset as Record<string, unknown>;
  const newRecord = newAsset as Record<string, unknown>;

  const allKeys = new Set<string>([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  for (const key of allKeys) {
    if (IGNORED_FOR_DIFF.has(key)) continue;
    if (!deepEqual(oldRecord[key], newRecord[key])) {
      changes[key] = { oldValue: oldRecord[key], newValue: newRecord[key] };
    }
  }
  return changes;
}

/**
 * Mescla um ativo existente com a versão recebida, preservando os
 * campos manuais do registro existente e anexando metadata
 * (`updatedFields`, `hasUnreadChanges`) com a lista de mudanças.
 */
function mergePreservingManual(
  existing: Asset,
  incoming: Asset,
  changedFields: AssetUpdatedFields
): Asset {
  const merged: Asset = { ...existing, ...incoming };
  const mergedRecord = merged as Record<string, unknown>;

  // Manual fields are always taken from the existing record when set,
  // and removed if neither side has them.
  for (const field of MANUAL_FIELDS) {
    const existingValue = (existing as Record<string, unknown>)[field];
    if (existingValue !== undefined) {
      mergedRecord[field] = existingValue;
    } else if ((incoming as Record<string, unknown>)[field] === undefined) {
      delete mergedRecord[field];
    }
  }

  merged.updatedFields = changedFields;
  merged.hasUnreadChanges = true;
  return merged;
}

function stripMeta(asset: Asset): Asset {
  const copy: Asset = { ...asset };
  for (const field of META_FIELDS) {
    delete (copy as Record<string, unknown>)[field];
  }
  return copy;
}

export interface MergeAssetsResult {
  assets: Asset[];
  added: number;
  updated: number;
  skipped: number;
  changesSummary: UploadAssetSummary[];
}

/**
 * Mescla `incomingAssets` em `existingAssets` aplicando a regra de
 * deduplicação por chave única (`nickName + maturityDate + indexers`).
 *
 * - Se a chave não existir, o ativo é adicionado (added).
 * - Se a chave existir e algum campo dinâmico mudou, o registro
 *   existente é atualizado preservando campos manuais (updated). O
 *   asset resultante carrega `updatedFields` (diff) e
 *   `hasUnreadChanges = true`.
 * - Se a chave existir e nada relevante mudou, o registro recebido
 *   é descartado (skipped — duplicidade evitada).
 */
export function mergeAssets(
  existingAssets: Asset[],
  incomingAssets: Asset[]
): MergeAssetsResult {
  const indexByKey = new Map<string, number>();
  const merged: Asset[] = existingAssets.map((asset, index) => {
    indexByKey.set(getAssetKey(asset), index);
    return asset;
  });

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const changesSummary: UploadAssetSummary[] = [];

  for (const incoming of incomingAssets) {
    const key = getAssetKey(incoming);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      // Truly new asset: drop any meta the incoming JSON might
      // accidentally carry (eg. re-import of a previously-exported file).
      const fresh = stripMeta(incoming);
      indexByKey.set(key, merged.length);
      merged.push(fresh);
      added += 1;
      changesSummary.push({
        assetKey: key,
        nickName: fresh.nickName,
        maturityDate: fresh.maturityDate,
        indexers: fresh.indexers,
        status: 'new',
      });
      continue;
    }

    const existing = merged[existingIndex];
    const changedFields = getChangedFields(existing, incoming);

    if (Object.keys(changedFields).length > 0) {
      merged[existingIndex] = mergePreservingManual(existing, incoming, changedFields);
      updated += 1;
      changesSummary.push({
        assetKey: key,
        nickName: incoming.nickName,
        maturityDate: incoming.maturityDate,
        indexers: incoming.indexers,
        status: 'updated',
        changedFields,
      });
    } else {
      skipped += 1;
      changesSummary.push({
        assetKey: key,
        nickName: incoming.nickName,
        maturityDate: incoming.maturityDate,
        indexers: incoming.indexers,
        status: 'unchanged',
      });
    }
  }

  return { assets: merged, added, updated, skipped, changesSummary };
}

/**
 * Gera um id ordenável e razoavelmente único para o registro de
 * histórico, usando `crypto.randomUUID()` quando disponível e
 * caindo para um fallback determinístico baseado em timestamp.
 */
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Constrói o registro de upload que será adicionado ao histórico.
 * Mantém uma cópia profunda do JSON original para visualização
 * posterior, sem afetar a base atual.
 */
export function buildUploadHistoryItem(params: {
  fileName: string;
  incomingAssets: Asset[];
  mergeResult: MergeAssetsResult;
}): UploadHistoryItem {
  const { fileName, incomingAssets, mergeResult } = params;
  return {
    id: generateId(),
    fileName,
    uploadedAt: new Date().toISOString(),
    totalRecords: incomingAssets.length,
    newRecords: mergeResult.added,
    updatedRecords: mergeResult.updated,
    unchangedRecords: mergeResult.skipped,
    originalJson: incomingAssets.map((a) => stripMeta(a)),
    changesSummary: mergeResult.changesSummary,
  };
}

/**
 * Adiciona o item ao histórico, mantendo no máximo
 * `MAX_UPLOAD_HISTORY` itens (mais recente primeiro). Ao ultrapassar
 * o limite, descarta o mais antigo automaticamente.
 */
export function addToUploadHistory(
  history: UploadHistoryItem[],
  item: UploadHistoryItem
): UploadHistoryItem[] {
  return [item, ...history].slice(0, MAX_UPLOAD_HISTORY);
}

/**
 * Remove a metadata interna (`updatedFields`, `hasUnreadChanges`)
 * antes do export para que o JSON exportado contenha apenas o
 * formato original esperado pelos consumidores.
 */
export function stripAssetMeta(asset: Asset): Asset {
  return stripMeta(asset);
}
