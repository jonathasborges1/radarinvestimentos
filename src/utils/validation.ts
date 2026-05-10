import type { Asset } from '../types';
import { normalizeAssetsForRead } from './assetMigration';

export type ValidationResult =
  | { valid: true; assets: Asset[] }
  | { valid: false; error: string };

/**
 * Validates that the input has the expected structure for an asset file:
 * - Must be a non-null object
 * - Must contain a `data` property
 * - `data` must be an array
 * - Each item must have `code` and `nickName` fields
 *
 * Empty `data` arrays are accepted as valid.
 */
export function validateAssetFile(data: unknown): ValidationResult {
  // Must be a non-null object
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      error: "Estrutura incompatível: o arquivo deve conter a propriedade 'data'.",
    };
  }

  const obj = data as Record<string, unknown>;

  // Must contain `data` property
  if (!('data' in obj)) {
    return {
      valid: false,
      error: "Estrutura incompatível: o arquivo deve conter a propriedade 'data'.",
    };
  }

  // `data` must be an array
  if (!Array.isArray(obj.data)) {
    return {
      valid: false,
      error: "Estrutura incompatível: a propriedade 'data' deve ser um array.",
    };
  }

  const items = obj.data as unknown[];

  // Validate each item has required fields
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return {
        valid: false,
        error: `Ativo na posição ${i} não possui o campo obrigatório 'code' ou 'nickName'.`,
      };
    }

    const record = item as Record<string, unknown>;

    const hasCode = 'code' in record && record.code !== undefined && record.code !== null;
    const hasNickName = 'nickName' in record && record.nickName !== undefined && record.nickName !== null;

    if (!hasCode || !hasNickName) {
      return {
        valid: false,
        error: `Ativo na posição ${i} não possui o campo obrigatório 'code' ou 'nickName'.`,
      };
    }
  }

  return {
    valid: true,
    assets: normalizeAssetsForRead(items as Asset[]),
  };
}
