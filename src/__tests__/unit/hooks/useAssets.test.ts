import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { AssetProvider } from '../../../context/AssetContext';
import { useAssets, mergeAssetChanges } from '../../../hooks/useAssets';
import type { Asset } from '../../../types';

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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AssetProvider, null, children);
}

describe('mergeAssetChanges', () => {
  it('preserves all original fields when merging changes', () => {
    const original = makeAsset({ code: 1 });
    const result = mergeAssetChanges(original, { b3Code: 'B3-001' });

    expect(result.nickName).toBe('CRA Test');
    expect(result.code).toBe(1);
    expect(result.b3Code).toBe('B3-001');
  });

  it('preserves extra fields not in the Asset type', () => {
    const original = { ...makeAsset({ code: 1 }), unknownField: 'extra' } as Asset;
    const result = mergeAssetChanges(original, { notes: 'test' });

    expect((result as Record<string, unknown>).unknownField).toBe('extra');
    expect(result.notes).toBe('test');
  });

  it('overwrites existing custom fields', () => {
    const original = makeAsset({ code: 1, b3Code: 'OLD' });
    const result = mergeAssetChanges(original, { b3Code: 'NEW' });

    expect(result.b3Code).toBe('NEW');
  });
});

describe('useAssets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useAssets(), { wrapper });

    expect(result.current.state.status).toBe('empty');
    expect(result.current.state.assets).toEqual([]);
  });

  describe('loadFromFile', () => {
    function createFile(content: string, name = 'test.json'): File {
      return new File([content], name, { type: 'application/json' });
    }

    it('loads a valid JSON file successfully', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const assets = [makeAsset({ code: 1 }), makeAsset({ code: 2 })];
      const file = createFile(JSON.stringify({ data: assets }));

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      expect(result.current.state.status).toBe('loaded');
      expect(result.current.state.assets).toHaveLength(2);
    });

    it('rejects invalid JSON', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const file = createFile('not valid json');

      await act(async () => {
        await expect(result.current.loadFromFile(file)).rejects.toThrow(
          'O arquivo selecionado não é um JSON válido.'
        );
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.errorMessage).toBe(
        'O arquivo selecionado não é um JSON válido.'
      );
    });

    it('rejects JSON without data property', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const file = createFile(JSON.stringify({ items: [] }));

      await act(async () => {
        await expect(result.current.loadFromFile(file)).rejects.toThrow(
          "Estrutura incompatível: o arquivo deve conter a propriedade 'data'."
        );
      });

      expect(result.current.state.status).toBe('error');
    });

    it('rejects JSON with items missing required fields', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const file = createFile(JSON.stringify({ data: [{ name: 'no code' }] }));

      await act(async () => {
        await expect(result.current.loadFromFile(file)).rejects.toThrow(
          "Ativo na posição 0 não possui o campo obrigatório 'code' ou 'nickName'."
        );
      });

      expect(result.current.state.status).toBe('error');
    });

    it('accepts empty data array', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const file = createFile(JSON.stringify({ data: [] }));

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      expect(result.current.state.status).toBe('loaded');
      expect(result.current.state.assets).toEqual([]);
    });
  });

  describe('exportToJson', () => {
    it('creates a download with correct filename format', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const assets = [makeAsset({ code: 1 })];
      const file = new File([JSON.stringify({ data: assets })], 'test.json', {
        type: 'application/json',
      });

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      // Mock DOM methods
      const createObjectURLMock = vi.fn(() => 'blob:test-url');
      const revokeObjectURLMock = vi.fn();
      (globalThis as Record<string, unknown>).URL = {
        ...URL,
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      };

      const clickMock = vi.fn();
      const appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeChildMock = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click: clickMock } as unknown as HTMLElement;
        }
        return document.createElement(tag);
      });

      act(() => {
        result.current.exportToJson();
      });

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
      expect(result.current.state.hasUnsavedChanges).toBe(false);

      appendChildMock.mockRestore();
      removeChildMock.mockRestore();
    });
  });

  describe('updateAsset', () => {
    it('dispatches UPDATE_ASSET with code and changes', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const assets = [makeAsset({ code: 1 }), makeAsset({ code: 2 })];
      const file = new File([JSON.stringify({ data: assets })], 'test.json', {
        type: 'application/json',
      });

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      act(() => {
        result.current.updateAsset(1, { b3Code: 'B3-001', notes: 'my note' });
      });

      expect(result.current.state.assets[0].b3Code).toBe('B3-001');
      expect(result.current.state.assets[0].notes).toBe('my note');
      expect(result.current.state.assets[1].b3Code).toBeUndefined();
      expect(result.current.state.hasUnsavedChanges).toBe(true);
    });
  });

  describe('clearStorage', () => {
    it('dispatches CLEAR_DATA and resets state', async () => {
      const { result } = renderHook(() => useAssets(), { wrapper });
      const assets = [makeAsset({ code: 1 })];
      const file = new File([JSON.stringify({ data: assets })], 'test.json', {
        type: 'application/json',
      });

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      expect(result.current.state.status).toBe('loaded');

      act(() => {
        result.current.clearStorage();
      });

      expect(result.current.state.status).toBe('empty');
      expect(result.current.state.assets).toEqual([]);
    });
  });
});
