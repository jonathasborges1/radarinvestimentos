import type { Asset } from './asset.ts';
import type { UploadHistoryItem } from './upload.ts';

export type AppStatus = 'empty' | 'loading' | 'error' | 'loaded';

export interface AssetState {
  status: AppStatus;
  assets: Asset[];
  originalAssets: Asset[];
  errorMessage: string | null;
  hasUnsavedChanges: boolean;
  uploadHistory: UploadHistoryItem[];
}

export type AssetAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: Asset[] }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'UPDATE_ASSET'; payload: { code: number | string; changes: Partial<Asset> } }
  | {
      type: 'MERGE_ASSETS';
      payload: {
        assets: Asset[];
        added: number;
        updated: number;
        skipped: number;
        historyItem: UploadHistoryItem;
      };
    }
  | { type: 'MARK_ASSET_READ'; payload: { key: string } }
  | { type: 'CLEAR_DATA' }
  | { type: 'MARK_EXPORTED' };
