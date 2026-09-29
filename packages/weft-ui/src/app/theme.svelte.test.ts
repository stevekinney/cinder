/**
 * `ThemeStore` unit tests (plan §13 T1.6, §1.7). Uses a real `document`
 * element and an in-memory `Storage` stand-in rather than `window`/
 * `window.localStorage` directly, so tests stay isolated from each other's
 * persisted state without hand-rolled cleanup.
 */
import { describe, expect, test } from 'bun:test';

import { nextThemeMode, ThemeStore, type ThemeMode } from './theme.svelte.ts';

class FakeStorage implements Storage {
  #store = new Map<string, string>();

  get length(): number {
    return this.#store.size;
  }

  clear(): void {
    this.#store.clear();
  }

  getItem(key: string): string | null {
    return this.#store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, value);
  }
}

function freshRoot(): HTMLElement {
  return document.createElement('html');
}

describe('nextThemeMode', () => {
  test('cycles light -> dark -> system -> light', () => {
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
    expect(nextThemeMode('system')).toBe('light');
  });
});

describe('ThemeStore', () => {
  test('defaults to system with no stored preference, no data-theme attribute applied', () => {
    const root = freshRoot();
    const store = new ThemeStore(root, new FakeStorage());

    expect(store.mode).toBe('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  test('reads a previously stored mode and applies it immediately', () => {
    const storage = new FakeStorage();
    storage.setItem('weft-ui-theme', 'dark');
    const root = freshRoot();

    const store = new ThemeStore(root, storage);

    expect(store.mode).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  test('ignores an invalid stored value and falls back to system', () => {
    const storage = new FakeStorage();
    storage.setItem('weft-ui-theme', 'not-a-real-mode');
    const root = freshRoot();

    const store = new ThemeStore(root, storage);

    expect(store.mode).toBe('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  test('set() applies data-theme for light/dark and persists the choice', () => {
    const storage = new FakeStorage();
    const root = freshRoot();
    const store = new ThemeStore(root, storage);

    store.set('light');
    expect(store.mode).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(storage.getItem('weft-ui-theme')).toBe('light');

    store.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(storage.getItem('weft-ui-theme')).toBe('dark');
  });

  test('set("system") removes the data-theme attribute', () => {
    const storage = new FakeStorage();
    const root = freshRoot();
    const store = new ThemeStore(root, storage);

    store.set('dark');
    expect(root.hasAttribute('data-theme')).toBe(true);

    store.set('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(storage.getItem('weft-ui-theme')).toBe('system');
  });

  test('cycle() advances through the same order as nextThemeMode', () => {
    const store = new ThemeStore(freshRoot(), new FakeStorage());
    const seen: ThemeMode[] = [store.mode];

    store.cycle();
    seen.push(store.mode);
    store.cycle();
    seen.push(store.mode);
    store.cycle();
    seen.push(store.mode);

    expect(seen).toEqual(['system', 'light', 'dark', 'system']);
  });

  test('a storage read failure falls back to system rather than throwing', () => {
    const throwingStorage: Storage = {
      length: 0,
      clear() {},
      getItem() {
        throw new Error('storage disabled');
      },
      key: () => null,
      removeItem() {},
      setItem() {
        throw new Error('storage disabled');
      },
    };

    const store = new ThemeStore(freshRoot(), throwingStorage);
    expect(store.mode).toBe('system');

    // set() should not throw even though persistence fails.
    expect(() => store.set('dark')).not.toThrow();
    expect(store.mode).toBe('dark');
  });
});
