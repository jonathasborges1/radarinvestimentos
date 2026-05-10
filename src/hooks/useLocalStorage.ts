import { useState, useCallback } from 'react';

export const STORAGE_KEY = 'yield-radar-assets';
export const STORAGE_VERSION_KEY = 'yield-radar-version';

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function readFromStorage<T>(key: string, initialValue: T): T {
  if (!isLocalStorageAvailable()) {
    console.warn(
      '[YieldRadar] localStorage indisponível. A aplicação funcionará sem persistência local.'
    );
    return initialValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (item === null) {
      return initialValue;
    }
    return JSON.parse(item) as T;
  } catch {
    console.warn(
      '[YieldRadar] Dados corrompidos no localStorage. Ignorando dados salvos.'
    );
    return initialValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() =>
    readFromStorage(key, initialValue)
  );

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      // Use React's functional-update form so we always compute from latest state,
      // then persist the resolved value to localStorage inside the same call.
      setStoredValue((prev) => {
        const newValue = typeof value === 'function'
          ? (value as (prev: T) => T)(prev)
          : value;

        if (!isLocalStorageAvailable()) {
          console.warn(
            '[YieldRadar] localStorage indisponível. Alterações não serão persistidas localmente.'
          );
          return newValue;
        }

        try {
          window.localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error: unknown) {
          if (
            error instanceof DOMException &&
            (error.name === 'QuotaExceededError' ||
              error.code === 22 ||
              error.code === 1014)
          ) {
            console.warn(
              '[YieldRadar] localStorage cheio (QuotaExceededError). A persistência local falhou.'
            );
          } else {
            console.warn(
              '[YieldRadar] Erro ao salvar no localStorage.',
              error
            );
          }
        }

        return newValue;
      });
    },
    [key]
  );

  const clearValue = useCallback(() => {
    setStoredValue(initialValue);

    if (!isLocalStorageAvailable()) {
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      console.warn('[YieldRadar] Erro ao limpar dados do localStorage.');
    }
  }, [key, initialValue]);

  return [storedValue, setValue, clearValue];
}
