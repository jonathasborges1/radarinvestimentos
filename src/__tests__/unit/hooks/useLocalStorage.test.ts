import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useLocalStorage,
  STORAGE_KEY,
  STORAGE_VERSION_KEY,
} from '../../../hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('exported constants', () => {
    it('should export STORAGE_KEY as yield-radar-assets', () => {
      expect(STORAGE_KEY).toBe('yield-radar-assets');
    });

    it('should export STORAGE_VERSION_KEY as yield-radar-version', () => {
      expect(STORAGE_VERSION_KEY).toBe('yield-radar-version');
    });
  });

  describe('initialization', () => {
    it('should return initialValue when localStorage is empty', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', { name: 'default' })
      );

      expect(result.current[0]).toEqual({ name: 'default' });
    });

    it('should return stored value when localStorage has valid data', () => {
      window.localStorage.setItem(
        'test-key',
        JSON.stringify({ name: 'stored' })
      );

      const { result } = renderHook(() =>
        useLocalStorage('test-key', { name: 'default' })
      );

      expect(result.current[0]).toEqual({ name: 'stored' });
    });

    it('should return initialValue when localStorage has corrupted data', () => {
      window.localStorage.setItem('test-key', 'not valid json {{{');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useLocalStorage('test-key', { name: 'default' })
      );

      expect(result.current[0]).toEqual({ name: 'default' });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dados corrompidos')
      );
    });
  });

  describe('setValue', () => {
    it('should update state and localStorage', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(JSON.parse(window.localStorage.getItem('test-key')!)).toBe(
        'updated'
      );
    });

    it('should handle complex objects', () => {
      const { result } = renderHook(() =>
        useLocalStorage('test-key', { items: [] as string[] })
      );

      act(() => {
        result.current[1]({ items: ['a', 'b', 'c'] });
      });

      expect(result.current[0]).toEqual({ items: ['a', 'b', 'c'] });
      expect(
        JSON.parse(window.localStorage.getItem('test-key')!)
      ).toEqual({ items: ['a', 'b', 'c'] });
    });

    it('should warn on QuotaExceededError without crashing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      // Mock setItem to throw QuotaExceededError only after initialization
      const quotaError = new DOMException(
        'Storage quota exceeded',
        'QuotaExceededError'
      );
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
        if (key === '__localStorage_test__') {
          // Allow the availability check to pass
          return;
        }
        throw quotaError;
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

      act(() => {
        result.current[1]('new value');
      });

      // State should still update even if localStorage fails
      expect(result.current[0]).toBe('new value');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('QuotaExceededError')
      );
    });
  });

  describe('clearValue', () => {
    it('should reset state to initialValue and remove from localStorage', () => {
      window.localStorage.setItem(
        'test-key',
        JSON.stringify('stored')
      );

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      expect(result.current[0]).toBe('stored');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('initial');
      expect(window.localStorage.getItem('test-key')).toBeNull();
    });
  });

  describe('localStorage unavailable', () => {
    it('should use initialValue and warn when localStorage is unavailable', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'fallback')
      );

      expect(result.current[0]).toBe('fallback');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('localStorage indisponível')
      );
    });

    it('should still update state when localStorage is unavailable on setValue', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useLocalStorage('test-key', 'initial')
      );

      // Now make localStorage unavailable for subsequent writes
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      act(() => {
        result.current[1]('new value');
      });

      expect(result.current[0]).toBe('new value');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('localStorage indisponível')
      );
    });
  });

  describe('with storage keys', () => {
    it('should work with STORAGE_KEY for assets', () => {
      const assets = [{ code: 1, nickName: 'Test Asset' }];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));

      const { result } = renderHook(() =>
        useLocalStorage(STORAGE_KEY, [] as { code: number; nickName: string }[])
      );

      expect(result.current[0]).toEqual(assets);
    });

    it('should work with STORAGE_VERSION_KEY', () => {
      window.localStorage.setItem(STORAGE_VERSION_KEY, JSON.stringify('1.0'));

      const { result } = renderHook(() =>
        useLocalStorage(STORAGE_VERSION_KEY, '')
      );

      expect(result.current[0]).toBe('1.0');
    });
  });
});
