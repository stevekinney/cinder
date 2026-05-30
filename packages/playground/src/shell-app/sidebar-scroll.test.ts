/**
 * Tests for the sidebar scroll-position persistence helper.
 *
 * - `readSidebarScroll` / `writeSidebarScroll` wrap `sessionStorage` access in
 *   try/catch so a thrown access (private mode, disabled storage, quota) never
 *   breaks scrolling. We stub `sessionStorage` at the global level per case,
 *   mirroring how `preview-store.test.ts` stubs `localStorage`.
 * - `persistScrollPosition` is the attachment: on attach it restores the saved
 *   offset; on scroll it persists (debounced); on teardown it clears the timer
 *   and removes the listener. We drive it with a fake element so we can assert
 *   the scroll/save/restore lifecycle without a real DOM.
 */

import { afterEach, describe, expect, it } from 'bun:test';

import {
  persistScrollPosition,
  readSidebarScroll,
  SIDEBAR_SCROLL_STORAGE_KEY,
  writeSidebarScroll,
} from './sidebar-scroll.ts';

type SessionStorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const originalSessionStorage = (globalThis as { sessionStorage?: Storage }).sessionStorage;

function installSessionStorage(stub: SessionStorageStub | undefined): void {
  if (stub === undefined) {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('sessionStorage unavailable');
      },
    });
    return;
  }
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: stub as unknown as Storage,
    writable: true,
  });
}

/** An in-memory sessionStorage stub backed by a Map. */
function makeMemoryStorage(): SessionStorageStub & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

afterEach(() => {
  if (originalSessionStorage === undefined) {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  } else {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
      writable: true,
    });
  }
});

describe('readSidebarScroll', () => {
  it('returns the stored integer offset', () => {
    installSessionStorage({ getItem: () => '420', setItem: () => {} });
    expect(readSidebarScroll()).toBe(420);
  });

  it('returns null when nothing is stored', () => {
    installSessionStorage({ getItem: () => null, setItem: () => {} });
    expect(readSidebarScroll()).toBeNull();
  });

  it('returns null when the stored value is not a number', () => {
    installSessionStorage({ getItem: () => 'not-a-number', setItem: () => {} });
    expect(readSidebarScroll()).toBeNull();
  });

  it('returns null for a negative stored value', () => {
    installSessionStorage({ getItem: () => '-10', setItem: () => {} });
    expect(readSidebarScroll()).toBeNull();
  });

  it('returns null when sessionStorage.getItem throws', () => {
    installSessionStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    });
    expect(readSidebarScroll()).toBeNull();
  });

  it('returns null when sessionStorage is not defined at all', () => {
    installSessionStorage(undefined);
    expect(readSidebarScroll()).toBeNull();
  });
});

describe('writeSidebarScroll', () => {
  it('forwards a rounded offset to sessionStorage under the scroll key', () => {
    const calls: Array<{ key: string; value: string }> = [];
    installSessionStorage({
      getItem: () => null,
      setItem: (key, value) => {
        calls.push({ key, value });
      },
    });
    writeSidebarScroll(123.7);
    expect(calls).toEqual([{ key: SIDEBAR_SCROLL_STORAGE_KEY, value: '124' }]);
  });

  it('does not throw when sessionStorage.setItem throws', () => {
    installSessionStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    });
    expect(() => writeSidebarScroll(50)).not.toThrow();
  });

  it('does not throw when sessionStorage is undefined', () => {
    installSessionStorage(undefined);
    expect(() => writeSidebarScroll(50)).not.toThrow();
  });
});

/**
 * A minimal stand-in for the scrollable sidebar element. It records added /
 * removed listeners and lets a test fire a synthetic scroll event.
 */
function makeFakeScrollElement(initialScrollTop = 0): {
  element: HTMLElement;
  fireScroll: () => void;
  listenerCount: () => number;
} {
  let scrollTop = initialScrollTop;
  const listeners = new Set<() => void>();
  const element = {
    get scrollTop() {
      return scrollTop;
    },
    set scrollTop(value: number) {
      scrollTop = value;
    },
    addEventListener: (_type: string, handler: () => void) => {
      listeners.add(handler);
    },
    removeEventListener: (_type: string, handler: () => void) => {
      listeners.delete(handler);
    },
  } as unknown as HTMLElement;

  return {
    element,
    fireScroll: () => {
      for (const handler of listeners) handler();
    },
    listenerCount: () => listeners.size,
  };
}

describe('persistScrollPosition attachment', () => {
  it('restores the saved scroll offset on attach', () => {
    const storage = makeMemoryStorage();
    storage.store.set(SIDEBAR_SCROLL_STORAGE_KEY, '300');
    installSessionStorage(storage);

    const { element } = makeFakeScrollElement(0);
    const cleanup = persistScrollPosition(element);

    expect(element.scrollTop).toBe(300);
    cleanup?.();
  });

  it('leaves scrollTop untouched when nothing is stored', () => {
    installSessionStorage(makeMemoryStorage());

    const { element } = makeFakeScrollElement(42);
    const cleanup = persistScrollPosition(element);

    expect(element.scrollTop).toBe(42);
    cleanup?.();
  });

  it('persists the scroll offset after the debounce window elapses', async () => {
    const storage = makeMemoryStorage();
    installSessionStorage(storage);

    const { element, fireScroll } = makeFakeScrollElement(0);
    const cleanup = persistScrollPosition(element);

    element.scrollTop = 250;
    fireScroll();
    // Not written synchronously — the write is debounced.
    expect(storage.store.get(SIDEBAR_SCROLL_STORAGE_KEY)).toBeUndefined();

    await Bun.sleep(200);
    expect(storage.store.get(SIDEBAR_SCROLL_STORAGE_KEY)).toBe('250');
    cleanup?.();
  });

  it('debounces a burst of scroll events into a single persisted write', async () => {
    const storage = makeMemoryStorage();
    const setCalls: string[] = [];
    storage.setItem = (key, value) => {
      if (key === SIDEBAR_SCROLL_STORAGE_KEY) setCalls.push(value);
      storage.store.set(key, value);
    };
    installSessionStorage(storage);

    const { element, fireScroll } = makeFakeScrollElement(0);
    const cleanup = persistScrollPosition(element);

    element.scrollTop = 10;
    fireScroll();
    element.scrollTop = 20;
    fireScroll();
    element.scrollTop = 30;
    fireScroll();

    await Bun.sleep(200);
    // Only the final position is written, not one write per scroll event.
    expect(setCalls).toEqual(['30']);
    cleanup?.();
  });

  it('clears the pending timer and removes the listener on teardown', async () => {
    const storage = makeMemoryStorage();
    installSessionStorage(storage);

    const { element, fireScroll, listenerCount } = makeFakeScrollElement(0);
    const cleanup = persistScrollPosition(element);
    expect(listenerCount()).toBe(1);

    element.scrollTop = 99;
    fireScroll();
    cleanup?.();

    // Listener gone…
    expect(listenerCount()).toBe(0);

    // …and the pending debounced write never lands after teardown.
    await Bun.sleep(200);
    expect(storage.store.get(SIDEBAR_SCROLL_STORAGE_KEY)).toBeUndefined();
  });
});
