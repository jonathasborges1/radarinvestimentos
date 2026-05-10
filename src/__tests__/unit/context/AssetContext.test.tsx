import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { assetReducer, AssetProvider, useAssetContext } from '../../../context/AssetContext';
import type { Asset, AssetState, AssetAction } from '../../../types';

// --- Reducer unit tests (pure function, no React needed) ---

const initialState: AssetState = {
  status: 'empty',
  assets: [],
  originalAssets: [],
  errorMessage: null,
  hasUnsavedChanges: false,
  uploadHistory: [],
};

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    nickName: 'CRA Test',
    maturityDate: '2025-12-31',
    fee: '10.5%',
    product: 'CRA',
    qualifiedInvestor: 'S',
    professionalInvestor: 'N',
    generalInvestor: 'N',
    indexers: 'CDI',
    incentive: 'S',
    ratingName: 'AAA',
    agencyName: 'Fitch',
    guaranteeFGC: false,
    redemptionType: 'Vencimento',
    code: 1001,
    ...overrides,
  };
}

describe('assetReducer', () => {
  it('LOAD_START sets status to loading and clears error', () => {
    const state: AssetState = { ...initialState, status: 'error', errorMessage: 'old error' };
    const result = assetReducer(state, { type: 'LOAD_START' });

    expect(result.status).toBe('loading');
    expect(result.errorMessage).toBeNull();
  });

  it('LOAD_SUCCESS sets assets, originalAssets, and status to loaded', () => {
    const assets = [makeAsset({ code: 1 }), makeAsset({ code: 2 })];
    const result = assetReducer(initialState, { type: 'LOAD_SUCCESS', payload: assets });

    expect(result.status).toBe('loaded');
    expect(result.assets).toHaveLength(2);
    expect(result.originalAssets).toHaveLength(2);
    expect(result.hasUnsavedChanges).toBe(false);
    expect(result.errorMessage).toBeNull();
  });

  it('LOAD_SUCCESS creates a deep copy for originalAssets', () => {
    const assets = [makeAsset({ code: 1 })];
    const result = assetReducer(initialState, { type: 'LOAD_SUCCESS', payload: assets });

    // They should be equal in value but not the same reference
    expect(result.assets[0]).toEqual(result.originalAssets[0]);
    expect(result.assets[0]).not.toBe(result.originalAssets[0]);
  });

  it('LOAD_ERROR sets status to error with message', () => {
    const state: AssetState = { ...initialState, status: 'loading' };
    const result = assetReducer(state, { type: 'LOAD_ERROR', payload: 'Arquivo inválido' });

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Arquivo inválido');
  });

  it('UPDATE_ASSET merges changes into the matching asset', () => {
    const assets = [makeAsset({ code: 1 }), makeAsset({ code: 2 })];
    const state: AssetState = {
      ...initialState,
      status: 'loaded',
      assets,
      originalAssets: assets.map((a) => ({ ...a })),
    };

    const result = assetReducer(state, {
      type: 'UPDATE_ASSET',
      payload: { code: 1, changes: { b3Code: 'B3-001', notes: 'test note' } },
    });

    expect(result.assets[0].b3Code).toBe('B3-001');
    expect(result.assets[0].notes).toBe('test note');
    expect(result.assets[0].nickName).toBe('CRA Test'); // original field preserved
    expect(result.hasUnsavedChanges).toBe(true);
  });

  it('UPDATE_ASSET does not modify other assets', () => {
    const assets = [makeAsset({ code: 1 }), makeAsset({ code: 2, nickName: 'Other' })];
    const state: AssetState = {
      ...initialState,
      status: 'loaded',
      assets,
      originalAssets: assets.map((a) => ({ ...a })),
    };

    const result = assetReducer(state, {
      type: 'UPDATE_ASSET',
      payload: { code: 1, changes: { b3Code: 'B3-001' } },
    });

    expect(result.assets[1].nickName).toBe('Other');
    expect(result.assets[1].b3Code).toBeUndefined();
  });

  it('UPDATE_ASSET sets hasUnsavedChanges to false when reverting to original', () => {
    const assets = [makeAsset({ code: 1 })];
    const originals = assets.map((a) => ({ ...a }));
    const state: AssetState = {
      ...initialState,
      status: 'loaded',
      assets: [{ ...assets[0], b3Code: 'changed' }],
      originalAssets: originals,
      hasUnsavedChanges: true,
    };

    // Revert the change by removing b3Code (set to undefined to match original)
    const result = assetReducer(state, {
      type: 'UPDATE_ASSET',
      payload: { code: 1, changes: { b3Code: undefined } },
    });

    // After reverting, assets should match originals again
    expect(result.hasUnsavedChanges).toBe(false);
  });

  it('CLEAR_DATA resets to initial state', () => {
    const state: AssetState = {
      status: 'loaded',
      assets: [makeAsset({ code: 1 })],
      originalAssets: [makeAsset({ code: 1 })],
      errorMessage: null,
      hasUnsavedChanges: true,
      uploadHistory: [],
    };

    const result = assetReducer(state, { type: 'CLEAR_DATA' });

    expect(result.status).toBe('empty');
    expect(result.assets).toEqual([]);
    expect(result.originalAssets).toEqual([]);
    expect(result.errorMessage).toBeNull();
    expect(result.hasUnsavedChanges).toBe(false);
  });

  it('MARK_EXPORTED sets hasUnsavedChanges to false and syncs originalAssets', () => {
    const assets = [makeAsset({ code: 1, b3Code: 'B3-001' })];
    const state: AssetState = {
      status: 'loaded',
      assets,
      originalAssets: [makeAsset({ code: 1 })],
      errorMessage: null,
      hasUnsavedChanges: true,
      uploadHistory: [],
    };

    const result = assetReducer(state, { type: 'MARK_EXPORTED' });

    expect(result.hasUnsavedChanges).toBe(false);
    expect(result.originalAssets).toEqual(result.assets);
    // originalAssets should be a copy, not the same reference
    expect(result.originalAssets[0]).not.toBe(result.assets[0]);
  });

  it('returns current state for unknown action type', () => {
    const state = { ...initialState };
    const result = assetReducer(state, { type: 'UNKNOWN' } as unknown as AssetAction);
    expect(result).toBe(state);
  });
});

// --- Provider + hook integration tests ---

describe('AssetProvider and useAssetContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <AssetProvider>{children}</AssetProvider>;
  }

  it('provides initial empty state when no localStorage data', () => {
    const { result } = renderHook(() => useAssetContext(), { wrapper });

    expect(result.current.state.status).toBe('empty');
    expect(result.current.state.assets).toEqual([]);
  });

  it('restores state from localStorage on initialization', () => {
    const assets = [makeAsset({ code: 42 })];
    window.localStorage.setItem('yield-radar-assets', JSON.stringify(assets));

    const { result } = renderHook(() => useAssetContext(), { wrapper });

    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.assets).toHaveLength(1);
    expect(result.current.state.assets[0].code).toBe(42);
  });

  it('dispatch LOAD_SUCCESS updates state and persists to localStorage', async () => {
    const { result } = renderHook(() => useAssetContext(), { wrapper });

    const assets = [makeAsset({ code: 10 }), makeAsset({ code: 20 })];

    act(() => {
      result.current.dispatch({ type: 'LOAD_SUCCESS', payload: assets });
    });

    expect(result.current.state.status).toBe('loaded');
    expect(result.current.state.assets).toHaveLength(2);

    // Check localStorage was updated
    const stored = JSON.parse(window.localStorage.getItem('yield-radar-assets') ?? '[]');
    expect(stored).toHaveLength(2);
  });

  it('dispatch CLEAR_DATA clears localStorage', () => {
    const assets = [makeAsset({ code: 1 })];
    window.localStorage.setItem('yield-radar-assets', JSON.stringify(assets));

    const { result } = renderHook(() => useAssetContext(), { wrapper });

    act(() => {
      result.current.dispatch({ type: 'CLEAR_DATA' });
    });

    expect(result.current.state.status).toBe('empty');
    expect(window.localStorage.getItem('yield-radar-assets')).toBeNull();
  });

  it('throws when useAssetContext is used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAssetContext());
    }).toThrow('useAssetContext must be used within an AssetProvider');

    spy.mockRestore();
  });
});
