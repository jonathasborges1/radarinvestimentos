import type { Asset } from '../types';

/**
 * Normaliza um ativo recém-carregado de uma fonte externa (JSON importado,
 * `data/db.json` ou localStorage) aplicando migrações de schema.
 *
 * Migração v1 → v2: o campo singular `fiduciaryAgentUrl` foi promovido a
 * array `fiduciaryAgentUrls` para suportar múltiplos agentes por ativo.
 * Aqui movemos o valor antigo para dentro do array (se ainda não estiver) e
 * removemos a propriedade legada para que escritas subsequentes saiam limpas.
 */
export function normalizeAssetForRead(asset: Asset): Asset {
  const record = asset as Record<string, unknown>;
  const legacy = record.fiduciaryAgentUrl;
  const current = record.fiduciaryAgentUrls;

  let urls: string[] | undefined;
  if (Array.isArray(current)) {
    urls = current.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }

  if ((!urls || urls.length === 0) && typeof legacy === 'string' && legacy.trim().length > 0) {
    urls = [legacy.trim()];
  }

  // Só reescreve o objeto se algo mudou — evita criar cópias desnecessárias.
  const needsRewrite = 'fiduciaryAgentUrl' in record || (urls && urls !== current);
  if (!needsRewrite) return asset;

  const next: Record<string, unknown> = { ...record };
  delete next.fiduciaryAgentUrl;
  if (urls && urls.length > 0) next.fiduciaryAgentUrls = urls;
  else delete next.fiduciaryAgentUrls;
  return next as Asset;
}

export function normalizeAssetsForRead(assets: Asset[]): Asset[] {
  return assets.map(normalizeAssetForRead);
}
