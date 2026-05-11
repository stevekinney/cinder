/**
 * Tests for the pure(-ish) helpers in `preview-store.svelte.ts`:
 *
 * - `readPersistedTheme` / `writePersistedTheme` wrap `localStorage` access
 *   in try/catch so a thrown access never breaks the bundle. The tests stub
 *   `localStorage` at the global level for the duration of each case.
 * - `applyThemeToDocument` sets or clears `color-scheme` on a document's
 *   `documentElement.style`. We use a minimal fake document.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  applyThemeToDocument,
  readPersistedTheme,
  THEME_STORAGE_KEY,
  writePersistedTheme,
  type ThemeChoice,
} from './preview-store.svelte.ts';

type LocalStorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;

function installLocalStorage(stub: LocalStorageStub | undefined): void {
  if (stub === undefined) {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage unavailable');
      },
    });
    return;
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: stub as unknown as Storage,
    writable: true,
  });
}

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  } else {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
      writable: true,
    });
  }
});

describe('readPersistedTheme', () => {
  it('returns the stored "light" value', () => {
    installLocalStorage({ getItem: () => 'light', setItem: () => {} });
    expect(readPersistedTheme()).toBe('light');
  });

  it('returns the stored "dark" value', () => {
    installLocalStorage({ getItem: () => 'dark', setItem: () => {} });
    expect(readPersistedTheme()).toBe('dark');
  });

  it('returns "system" when the stored value is missing', () => {
    installLocalStorage({ getItem: () => null, setItem: () => {} });
    expect(readPersistedTheme()).toBe('system');
  });

  it('returns "system" when the stored value is an unknown string', () => {
    installLocalStorage({ getItem: () => 'midnight', setItem: () => {} });
    expect(readPersistedTheme()).toBe('system');
  });

  it('returns "system" when localStorage.getItem throws', () => {
    installLocalStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(readPersistedTheme()).toBe('system');
  });

  it('returns "system" when localStorage is not defined at all', () => {
    installLocalStorage(undefined);
    expect(readPersistedTheme()).toBe('system');
  });
});

describe('writePersistedTheme', () => {
  it('forwards the value to localStorage under THEME_STORAGE_KEY', () => {
    const calls: Array<{ key: string; value: string }> = [];
    installLocalStorage({
      getItem: () => null,
      setItem: (key, value) => {
        calls.push({ key, value });
      },
    });
    writePersistedTheme('dark');
    expect(calls).toEqual([{ key: THEME_STORAGE_KEY, value: 'dark' }]);
  });

  it('does not throw when localStorage.setItem throws', () => {
    installLocalStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    });
    expect(() => writePersistedTheme('light')).not.toThrow();
  });

  it('does not throw when localStorage is undefined', () => {
    installLocalStorage(undefined);
    expect(() => writePersistedTheme('light')).not.toThrow();
  });
});

function makeFakeDocument(): Document {
  return {
    documentElement: { style: { colorScheme: '' }, dataset: {} as Record<string, string> },
  } as unknown as Document;
}

describe('applyThemeToDocument', () => {
  const cases: Array<[ThemeChoice, string]> = [
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', ''], // empty string clears the inline override
  ];

  for (const [input, expected] of cases) {
    it(`sets colorScheme to "${expected}" for "${input}"`, () => {
      const doc = makeFakeDocument();
      applyThemeToDocument(doc, input);
      expect(doc.documentElement.style.colorScheme).toBe(expected);
    });
  }

  it('clears a previously-set inline override when called with "system"', () => {
    const doc = makeFakeDocument();
    doc.documentElement.style.colorScheme = 'dark';
    applyThemeToDocument(doc, 'system');
    expect(doc.documentElement.style.colorScheme).toBe('');
  });

  it('writes data-cinder-theme for every choice including "system"', () => {
    for (const choice of ['light', 'dark', 'system'] as const) {
      const doc = makeFakeDocument();
      applyThemeToDocument(doc, choice);
      expect(doc.documentElement.dataset['cinderTheme']).toBe(choice);
    }
  });
});
