/// <reference lib="dom" />
/**
 * Unit tests for `component-page-theme.ts`'s pure reads and the DOM/storage
 * write `applyTheme` performs.
 *
 * happy-dom is installed globally by `scripts/preload.ts`, so `document`,
 * `window`, `localStorage`, and `sessionStorage` all exist by default here —
 * the SSR/no-storage cases delete the relevant global for the duration of one
 * test, mirroring `preview-store.test.ts`'s stubbing pattern.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  applyTheme,
  readInitialPreviewWidth,
  readInitialTheme,
  readStoredNavFilter,
} from './component-page-theme.ts';
import { THEME_STORAGE_KEY } from './shell-app/theme-storage.ts';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalSessionStorage = globalThis.sessionStorage;

afterEach(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
    writable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: originalSessionStorage,
    writable: true,
  });
  document.documentElement.style.colorScheme = '';
  delete document.documentElement.dataset['cinderTheme'];
});

describe('readInitialTheme', () => {
  it('returns "light" when document is undefined (SSR)', () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: undefined });
    expect(readInitialTheme()).toBe('light');
  });

  it('reads a concrete color-scheme from documentElement.style', () => {
    document.documentElement.style.colorScheme = 'dark';
    expect(readInitialTheme()).toBe('dark');
  });

  it('falls back to dataset.cinderTheme when color-scheme is not a concrete value', () => {
    document.documentElement.style.colorScheme = '';
    document.documentElement.dataset['cinderTheme'] = 'dark';
    expect(readInitialTheme()).toBe('dark');
  });

  it('defaults to "light" when neither signal indicates dark', () => {
    document.documentElement.style.colorScheme = '';
    delete document.documentElement.dataset['cinderTheme'];
    expect(readInitialTheme()).toBe('light');
  });
});

describe('readInitialPreviewWidth', () => {
  it('returns null when window is undefined', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
    expect(readInitialPreviewWidth()).toBeNull();
  });

  it('delegates to readPreviewWidthFromSearch otherwise', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { search: '?w=768' } },
    });
    expect(readInitialPreviewWidth()).toBe(768);
  });

  it('returns null for an out-of-range or missing width param', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { search: '' } },
    });
    expect(readInitialPreviewWidth()).toBeNull();
  });
});

describe('readStoredNavFilter', () => {
  it('returns "" when sessionStorage is unavailable', () => {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: undefined });
    expect(readStoredNavFilter()).toBe('');
  });

  it('returns the stored value when present', () => {
    sessionStorage.setItem('cinder-playground-nav-filter', 'accordion');
    expect(readStoredNavFilter()).toBe('accordion');
    sessionStorage.removeItem('cinder-playground-nav-filter');
  });

  it('returns "" when sessionStorage.getItem throws', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(readStoredNavFilter()).toBe('');
  });
});

describe('applyTheme', () => {
  it('sets colorScheme, dataset.cinderTheme, and localStorage for "dark"', () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    applyTheme('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.dataset['cinderTheme']).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('sets colorScheme, dataset.cinderTheme, and localStorage for "light"', () => {
    applyTheme('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.dataset['cinderTheme']).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('still updates the DOM and does not throw when localStorage.setItem throws', () => {
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        setItem: () => {
          throw new Error('quota exceeded');
        },
      },
    });
    try {
      expect(() => applyTheme('dark')).not.toThrow();
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(document.documentElement.dataset['cinderTheme']).toBe('dark');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
        writable: true,
      });
    }
  });
});
