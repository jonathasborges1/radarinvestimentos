import { useCallback } from 'react';
import type { Asset, UploadHistoryItem } from '../types';
import { useAssetContext } from '../context/AssetContext';
import { validateAssetFile } from '../utils/validation';
import { serializeAssets } from '../utils/serialization';
import { buildUploadHistoryItem, getAssetKey, mergeAssets } from '../utils/assetKey';

export interface MergeResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface UseAssetsReturn {
  state: ReturnType<typeof useAssetContext>['state'];
  dispatch: ReturnType<typeof useAssetContext>['dispatch'];
  loadFromFile: (file: File) => Promise<void>;
  mergeFromFile: (file: File) => Promise<MergeResult>;
  exportToJson: () => void;
  updateAsset: (code: number | string, changes: Partial<Asset>) => void;
  markAssetRead: (asset: Asset) => void;
  uploadHistory: UploadHistoryItem[];
  clearStorage: () => void;
}

/**
 * Merges changes into an asset, preserving all original fields and extra fields.
 * Only updates the specified custom fields without removing any existing properties.
 */
export function mergeAssetChanges(asset: Asset, changes: Partial<Asset>): Asset {
  return { ...asset, ...changes };
}

/**
 * Hook that wraps AssetContext and provides convenient methods for
 * loading files, exporting JSON, updating assets, and clearing storage.
 */
export function useAssets(): UseAssetsReturn {
  const { state, dispatch } = useAssetContext();

  const loadFromFile = useCallback(
    (file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        dispatch({ type: 'LOAD_START' });

        const reader = new FileReader();

        reader.onload = (event) => {
          try {
            const content = event.target?.result;
            if (typeof content !== 'string') {
              dispatch({
                type: 'LOAD_ERROR',
                payload: 'Não foi possível ler o arquivo. Tente novamente.',
              });
              reject(new Error('Não foi possível ler o arquivo. Tente novamente.'));
              return;
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(content);
            } catch {
              dispatch({
                type: 'LOAD_ERROR',
                payload: 'O arquivo selecionado não é um JSON válido.',
              });
              reject(new Error('O arquivo selecionado não é um JSON válido.'));
              return;
            }

            const result = validateAssetFile(parsed);

            if (!result.valid) {
              dispatch({ type: 'LOAD_ERROR', payload: result.error });
              reject(new Error(result.error));
              return;
            }

            dispatch({ type: 'LOAD_SUCCESS', payload: result.assets });
            resolve();
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Não foi possível ler o arquivo. Tente novamente.';
            dispatch({ type: 'LOAD_ERROR', payload: message });
            reject(new Error(message));
          }
        };

        reader.onerror = () => {
          dispatch({
            type: 'LOAD_ERROR',
            payload: 'Não foi possível ler o arquivo. Tente novamente.',
          });
          reject(new Error('Não foi possível ler o arquivo. Tente novamente.'));
        };

        reader.readAsText(file);
      });
    },
    [dispatch]
  );

  const mergeFromFile = useCallback(
    (file: File): Promise<MergeResult> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
          try {
            const content = event.target?.result;
            if (typeof content !== 'string') {
              reject(new Error('Não foi possível ler o arquivo. Tente novamente.'));
              return;
            }

            let parsed: unknown;
            try {
              parsed = JSON.parse(content);
            } catch {
              reject(new Error('O arquivo selecionado não é um JSON válido.'));
              return;
            }

            const result = validateAssetFile(parsed);

            if (!result.valid) {
              reject(new Error(result.error));
              return;
            }

            // Merge by stable identity (nickName + maturityDate + indexers),
            // tracking changed fields and preserving manual ones.
            const merge = mergeAssets(state.assets, result.assets);
            const historyItem = buildUploadHistoryItem({
              fileName: file.name,
              incomingAssets: result.assets,
              mergeResult: merge,
            });

            dispatch({
              type: 'MERGE_ASSETS',
              payload: {
                assets: merge.assets,
                added: merge.added,
                updated: merge.updated,
                skipped: merge.skipped,
                historyItem,
              },
            });

            resolve({ added: merge.added, updated: merge.updated, skipped: merge.skipped });
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Não foi possível ler o arquivo. Tente novamente.';
            reject(new Error(message));
          }
        };

        reader.onerror = () => {
          reject(new Error('Não foi possível ler o arquivo. Tente novamente.'));
        };

        reader.readAsText(file);
      });
    },
    [dispatch, state.assets]
  );

  const exportToJson = useCallback(() => {
    const json = serializeAssets(state.assets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const fileName = `ativos_${year}-${month}-${day}.json`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    dispatch({ type: 'MARK_EXPORTED' });
  }, [state.assets, dispatch]);

  const updateAsset = useCallback(
    (code: number | string, changes: Partial<Asset>) => {
      dispatch({ type: 'UPDATE_ASSET', payload: { code, changes } });
    },
    [dispatch]
  );

  const markAssetRead = useCallback(
    (asset: Asset) => {
      if (!asset.hasUnreadChanges) return;
      dispatch({ type: 'MARK_ASSET_READ', payload: { key: getAssetKey(asset) } });
    },
    [dispatch]
  );

  const clearStorage = useCallback(() => {
    dispatch({ type: 'CLEAR_DATA' });
  }, [dispatch]);

  return {
    state,
    dispatch,
    loadFromFile,
    mergeFromFile,
    exportToJson,
    updateAsset,
    markAssetRead,
    uploadHistory: state.uploadHistory,
    clearStorage,
  };
}
