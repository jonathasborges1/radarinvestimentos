import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { Asset, AssetState, AssetAction, UploadHistoryItem } from '../types';
import { useLocalStorage, STORAGE_KEY } from '../hooks/useLocalStorage';
import {
  addToUploadHistory,
  getAssetKey,
  MAX_UPLOAD_HISTORY,
  stripAssetMeta,
} from '../utils/assetKey';

const IS_DEV = import.meta.env.DEV
const UPLOAD_HISTORY_KEY = 'yield-radar-upload-history';

async function loadAssetsFromFile(): Promise<Asset[] | null> {
  try {
    const res = await fetch('/api/assets')
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data : null
  } catch {
    return null
  }
}

async function saveAssetsToFile(assets: Asset[]): Promise<void> {
  try {
    await fetch('/api/assets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assets.map(stripAssetMeta)),
    })
  } catch {
    console.warn('[YieldRadar] Falha ao salvar em data/db.json')
  }
}

const initialState: AssetState = {
  status: 'empty',
  assets: [],
  originalAssets: [],
  errorMessage: null,
  hasUnsavedChanges: false,
  uploadHistory: [],
};

/**
 * Pure reducer for asset state management.
 * Handles all state transitions for loading, updating, clearing, and exporting assets.
 */
export function assetReducer(state: AssetState, action: AssetAction): AssetState {
  switch (action.type) {
    case 'LOAD_START':
      return {
        ...state,
        status: 'loading',
        errorMessage: null,
      };

    case 'LOAD_SUCCESS': {
      const assets = action.payload;
      return {
        ...state,
        status: 'loaded',
        assets,
        originalAssets: assets.map((a) => ({ ...a })),
        errorMessage: null,
        hasUnsavedChanges: false,
      };
    }

    case 'LOAD_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload,
      };

    case 'UPDATE_ASSET': {
      const { code, changes } = action.payload;
      const updatedAssets = state.assets.map((asset) =>
        asset.code === code ? { ...asset, ...changes } : asset
      );
      const hasChanges = !areAssetsEqual(updatedAssets, state.originalAssets);
      return {
        ...state,
        assets: updatedAssets,
        hasUnsavedChanges: hasChanges,
      };
    }

    case 'CLEAR_DATA':
      return { ...initialState };

    case 'MERGE_ASSETS': {
      const { assets: merged, added, updated, historyItem } = action.payload;
      return {
        ...state,
        status: 'loaded',
        assets: merged,
        originalAssets: merged.map((a) => ({ ...a })),
        errorMessage: null,
        hasUnsavedChanges: added + updated > 0,
        uploadHistory: addToUploadHistory(state.uploadHistory, historyItem),
      };
    }

    case 'MARK_ASSET_READ': {
      const { key } = action.payload;
      const clear = (asset: Asset): Asset =>
        getAssetKey(asset) === key && asset.hasUnreadChanges
          ? { ...asset, hasUnreadChanges: false }
          : asset;
      return {
        ...state,
        assets: state.assets.map(clear),
        originalAssets: state.originalAssets.map(clear),
      };
    }

    case 'MARK_EXPORTED':
      return {
        ...state,
        originalAssets: state.assets.map((a) => ({ ...a })),
        hasUnsavedChanges: false,
      };

    default:
      return state;
  }
}

/**
 * Compares two asset arrays for equality, ignoring app-internal
 * metadata (`updatedFields`, `hasUnreadChanges`) so toggling the read
 * flag does not mark the dataset as "unsaved".
 */
function areAssetsEqual(a: Asset[], b: Asset[]): boolean {
  if (a.length !== b.length) return false;
  return (
    JSON.stringify(a.map(stripAssetMeta)) === JSON.stringify(b.map(stripAssetMeta))
  );
}

interface AssetContextValue {
  state: AssetState;
  dispatch: Dispatch<AssetAction>;
}

const AssetContext = createContext<AssetContextValue | null>(null);

interface AssetProviderProps {
  children: ReactNode;
}

/**
 * Provider component that manages global asset state with useReducer
 * and automatically persists changes to localStorage.
 */
export function AssetProvider({ children }: AssetProviderProps) {
  const [storedAssets, setStoredAssets, clearStoredAssets] = useLocalStorage<Asset[] | null>(
    STORAGE_KEY,
    null
  );

  const [storedHistory, setStoredHistory, clearStoredHistory] =
    useLocalStorage<UploadHistoryItem[]>(UPLOAD_HISTORY_KEY, []);

  const [state, dispatch] = useReducer(assetReducer, initialState, (initial) => {
    const restoredHistory = Array.isArray(storedHistory)
      ? storedHistory.slice(0, MAX_UPLOAD_HISTORY)
      : [];
    // On initialization, restore from localStorage if valid data exists
    if (storedAssets && Array.isArray(storedAssets) && storedAssets.length > 0) {
      return {
        status: 'loaded' as const,
        assets: storedAssets,
        originalAssets: storedAssets.map((a) => ({ ...a })),
        errorMessage: null,
        hasUnsavedChanges: false,
        uploadHistory: restoredHistory,
      };
    }
    return { ...initial, uploadHistory: restoredHistory };
  });

  // On mount in dev, load from file (takes priority over localStorage)
  useEffect(() => {
    if (!IS_DEV) return
    loadAssetsFromFile().then(assets => {
      if (assets) dispatch({ type: 'LOAD_SUCCESS', payload: assets })
    })
  }, [])

  // Sync assets to localStorage and file (dev) on every state change
  useEffect(() => {
    if (state.status === 'loaded' && state.assets.length > 0) {
      setStoredAssets(state.assets);
      if (IS_DEV) saveAssetsToFile(state.assets)
    } else if (state.status === 'empty') {
      clearStoredAssets();
      if (IS_DEV) saveAssetsToFile([])
    }
  }, [state.status, state.assets, setStoredAssets, clearStoredAssets]);

  // Sync upload history to localStorage on every change
  useEffect(() => {
    if (state.uploadHistory.length > 0) {
      setStoredHistory(state.uploadHistory);
    } else {
      clearStoredHistory();
    }
  }, [state.uploadHistory, setStoredHistory, clearStoredHistory]);

  return (
    <AssetContext.Provider value={{ state, dispatch }}>
      {children}
    </AssetContext.Provider>
  );
}

/**
 * Hook to consume the AssetContext.
 * Must be used within an AssetProvider.
 */
export function useAssetContext(): AssetContextValue {
  const context = useContext(AssetContext);
  if (context === null) {
    throw new Error('useAssetContext must be used within an AssetProvider');
  }
  return context;
}

export { AssetContext };
