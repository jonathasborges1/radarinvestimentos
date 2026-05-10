import type { ColumnKey } from '../types/column';

export type Preferences = {
  columns?: ColumnKey[];
  itemsPerPage?: number | 'all';
};

export async function loadPreferences(): Promise<Preferences> {
  try {
    const res = await fetch('/api/preferences');
    if (!res.ok) return {};
    const data = await res.json();
    // Formato legado: o arquivo era apenas um array de ColumnKey.
    if (Array.isArray(data)) return { columns: data as ColumnKey[] };
    return data && typeof data === 'object' ? (data as Preferences) : {};
  } catch {
    return {};
  }
}

/**
 * Aplica um patch parcial ao preferences.json fazendo GET-merge-PUT,
 * para que múltiplos hooks possam atualizar campos diferentes sem se sobrescrever.
 */
export async function patchPreferences(patch: Preferences): Promise<void> {
  try {
    const current = await loadPreferences();
    const merged: Preferences = { ...current, ...patch };
    await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  } catch {
    console.warn('[YieldRadar] Falha ao salvar preferências em data/preferences.json');
  }
}
