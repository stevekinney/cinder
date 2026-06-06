/**
 * Tests for the pure(-ish) helpers in `preview-store.svelte.ts`:
 *
 * - `readPersistedTheme` / `writePersistedTheme` wrap `localStorage` access
 *   in try/catch so a thrown access never breaks the bundle. `readPersistedTheme`
 *   returns the stored override (`light`/`dark`) or `null` when there is none —
 *   `null` is the signal to follow the browser's `prefers-color-scheme`. The
 *   tests stub `localStorage` at the global level for the duration of each case.
 * - `applyThemeToDocument` pins or clears `color-scheme` on a document's
 *   `documentElement.style` depending on whether an override is set. We use a
 *   minimal fake document.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  applyColorTokenOverridesToDocument,
  applyThemeToDocument,
  PreviewStore,
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
const originalWindow = (globalThis as { window?: Window }).window;
const originalHistory = (globalThis as { history?: History }).history;

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
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
      writable: true,
    });
  }
  if (originalHistory === undefined) {
    delete (globalThis as { history?: History }).history;
  } else {
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      value: originalHistory,
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

  it('returns null (no override) when the stored value is missing', () => {
    installLocalStorage({ getItem: () => null, setItem: () => {} });
    expect(readPersistedTheme()).toBeNull();
  });

  it('returns null when the stored value is the retired "system" string', () => {
    installLocalStorage({ getItem: () => 'system', setItem: () => {} });
    expect(readPersistedTheme()).toBeNull();
  });

  it('returns null when the stored value is an unknown string', () => {
    installLocalStorage({ getItem: () => 'midnight', setItem: () => {} });
    expect(readPersistedTheme()).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    installLocalStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(readPersistedTheme()).toBeNull();
  });

  it('returns null when localStorage is not defined at all', () => {
    installLocalStorage(undefined);
    expect(readPersistedTheme()).toBeNull();
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
  const properties = new Map<string, string>();
  const style = {
    colorScheme: '',
    setProperty(name: string, value: string) {
      properties.set(name, value);
    },
    removeProperty(name: string) {
      properties.delete(name);
      return '';
    },
    getPropertyValue(name: string) {
      return properties.get(name) ?? '';
    },
  };
  return {
    documentElement: { style, dataset: {} as Record<string, string> },
  } as unknown as Document;
}

describe('applyThemeToDocument', () => {
  // An explicit override pins colorScheme to that value; no override (null)
  // clears the inline value so the OS preference and base CSS drive rendering.
  const cases: Array<[ThemeChoice | null, string]> = [
    ['light', 'light'],
    ['dark', 'dark'],
    [null, ''], // empty string clears the inline override
  ];

  for (const [override, expected] of cases) {
    it(`sets colorScheme to "${expected}" for override ${String(override)}`, () => {
      const doc = makeFakeDocument();
      // `resolved` only matters when there is no override; pass 'light' as the
      // resolved browser preference for these colorScheme assertions.
      applyThemeToDocument(doc, override, 'light');
      expect(doc.documentElement.style.colorScheme).toBe(expected);
    });
  }

  it('clears a previously-set inline override when there is no override', () => {
    const doc = makeFakeDocument();
    doc.documentElement.style.colorScheme = 'dark';
    applyThemeToDocument(doc, null, 'light');
    expect(doc.documentElement.style.colorScheme).toBe('');
  });

  it('writes data-cinder-theme to the override when one is set', () => {
    for (const override of ['light', 'dark'] as const) {
      const doc = makeFakeDocument();
      applyThemeToDocument(doc, override, 'light');
      expect(doc.documentElement.dataset['cinderTheme']).toBe(override);
    }
  });

  it('writes data-cinder-theme to the resolved browser theme when there is no override', () => {
    for (const resolved of ['light', 'dark'] as const) {
      const doc = makeFakeDocument();
      applyThemeToDocument(doc, null, resolved);
      expect(doc.documentElement.dataset['cinderTheme']).toBe(resolved);
    }
  });
});

describe('color token overrides', () => {
  it('stores overrides per theme', () => {
    const store = new PreviewStore('button', { theme: 'light' });

    expect(store.setColorTokenOverride('light', '--cinder-accent', 'oklch(60% 0.2 195)')).toBe(
      true,
    );
    expect(store.setColorTokenOverride('dark', '--cinder-accent', 'oklch(78% 0.16 195)')).toBe(
      true,
    );

    expect(store.colorTokenOverrides.light['--cinder-accent']).toBe('oklch(60% 0.2 195)');
    expect(store.colorTokenOverrides.dark['--cinder-accent']).toBe('oklch(78% 0.16 195)');
    expect(store.getActiveColorTokenOverrides()).toEqual({
      '--cinder-accent': 'oklch(60% 0.2 195)',
    });
  });

  it('resets one token or the full active-theme override set', () => {
    const store = new PreviewStore('button', { theme: 'light' });
    store.setColorTokenOverride('light', '--cinder-accent', 'oklch(60% 0.2 195)');
    store.setColorTokenOverride('light', '--cinder-bg', 'oklch(97% 0.02 245)');
    store.setColorTokenOverride('dark', '--cinder-accent', 'oklch(78% 0.16 195)');

    store.resetColorTokenOverride('light', '--cinder-bg');
    expect(store.colorTokenOverrides.light).toEqual({
      '--cinder-accent': 'oklch(60% 0.2 195)',
    });

    store.resetColorTokenOverrides('light');
    expect(store.colorTokenOverrides.light).toEqual({});
    expect(store.colorTokenOverrides.dark).toEqual({
      '--cinder-accent': 'oklch(78% 0.16 195)',
    });
  });

  it('rejects unknown tokens and unsafe values', () => {
    const store = new PreviewStore('button', { theme: 'light' });

    expect(
      store.setColorTokenOverride('light', '--cinder-accent', 'url(https://example.com)'),
    ).toBe(false);
    // @ts-expect-error — exercising runtime validation for untrusted callers
    expect(store.setColorTokenOverride('light', '--cinder-button-bg', 'oklch(60% 0.2 195)')).toBe(
      false,
    );
    expect(store.colorTokenOverrides.light).toEqual({});
  });

  it('does not write color overrides to localStorage or the URL', () => {
    const storageCalls: string[] = [];
    const historyCalls: string[] = [];
    installLocalStorage({
      getItem: () => null,
      setItem: (key, value) => {
        storageCalls.push(`${key}:${value}`);
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      value: {
        replaceState(_state: unknown, _unused: string, href: string) {
          historyCalls.push(href);
        },
      },
      writable: true,
    });

    const store = new PreviewStore('button', { theme: 'light' });
    store.setColorTokenOverride('light', '--cinder-accent', 'oklch(60% 0.2 195)');
    store.resetColorTokenOverride('light', '--cinder-accent');
    store.setColorTokenOverride('dark', '--cinder-accent', 'oklch(78% 0.16 195)');
    store.resetColorTokenOverrides('dark');

    expect(storageCalls).toEqual([]);
    expect(historyCalls).toEqual([]);
  });

  it('applies only validated color token overrides to a document root', () => {
    const doc = makeFakeDocument();

    doc.documentElement.style.setProperty('--cinder-bg', 'oklch(97% 0.01 245)');
    applyColorTokenOverridesToDocument(doc, {
      '--cinder-accent': 'oklch(60% 0.2 195)',
    });

    expect(doc.documentElement.style.getPropertyValue('--cinder-bg')).toBe('');
    expect(doc.documentElement.style.getPropertyValue('--cinder-accent')).toBe(
      'oklch(60% 0.2 195)',
    );
  });
});
