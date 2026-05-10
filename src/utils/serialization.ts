import type { Asset } from '../types';
import { validateAssetFile } from './validation';
import { stripAssetMeta } from './assetKey';

/**
 * Serializes an array of assets into a JSON string with the structure `{"data": [...]}`.
 * Preserves ALL fields including unknown/extra fields not defined in the Asset type,
 * but strips internal app metadata (`updatedFields`, `hasUnreadChanges`) so that
 * exporting + re-importing does not carry stale "unread" state.
 */
export function serializeAssets(assets: Asset[]): string {
  return JSON.stringify({ data: assets.map(stripAssetMeta) }, null, 2);
}

/**
 * Deserializes a JSON string into an array of assets.
 * Validates the structure using `validateAssetFile` and throws an error if invalid.
 * Preserves all fields including unknown/extra fields.
 */
export function deserializeAssets(json: string): Asset[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido.');
  }

  const result = validateAssetFile(parsed);

  if (!result.valid) {
    throw new Error(result.error);
  }

  return result.assets;
}
