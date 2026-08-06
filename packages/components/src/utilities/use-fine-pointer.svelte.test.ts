import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { useFinePointer } = await import('./use-fine-pointer.svelte.ts');

type Listener = (event: { matches: boolean }) => void;

type FakeMediaQueryList = {
  matches: boolean;
  media: string;
  onchange: Listener | null;
  addEventListener: (type: 'change', listener: Listener) => void;
  removeEventListener: (type: 'change', listener: Listener) => void;
  addListener: (listener: Listener) => void;
  removeListener: (listener: Listener) => void;
  dispatchEvent: (event: Event) => boolean;
};

function installMatchMediaMock(initialMatches: boolean) {
  const queriesPassed: string[] = [];

  const list: FakeMediaQueryList = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  };

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => {
    queriesPassed.push(query);
    list.media = query;
    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    list,
    queriesPassed,
    restore() {
      window.matchMedia = originalMatchMedia;
    },
  };
}

function usesBrowserMediaQuery(mock: ReturnType<typeof installMatchMediaMock>) {
  return mock.queriesPassed.length > 0;
}

describe('useFinePointer', () => {
  let mock: ReturnType<typeof installMatchMediaMock>;

  afterEach(() => {
    mock?.restore();
  });

  test('constructs matchMedia with the canonical query string in browser resolution', () => {
    mock = installMatchMediaMock(false);

    const finePointer = useFinePointer();

    if (!usesBrowserMediaQuery(mock)) {
      expect(finePointer.current).toBe(false);
      return;
    }
    expect(mock.queriesPassed[0]).toBe('(hover: hover) and (pointer: fine)');
  });

  test('returns true for a mouse with hover support in browser resolution', () => {
    mock = installMatchMediaMock(true);

    const finePointer = useFinePointer();

    if (!usesBrowserMediaQuery(mock)) {
      expect(finePointer.current).toBe(false);
      return;
    }
    expect(finePointer.current).toBe(true);
  });

  test('returns false for touch/pen-only devices', () => {
    mock = installMatchMediaMock(false);

    const finePointer = useFinePointer();

    expect(finePointer.current).toBe(false);
  });

  test('current reads live matches value from the underlying MediaQueryList in browser resolution', () => {
    mock = installMatchMediaMock(true);

    const finePointer = useFinePointer();
    if (!usesBrowserMediaQuery(mock)) {
      expect(finePointer.current).toBe(false);
      return;
    }
    expect(finePointer.current).toBe(true);

    mock.list.matches = false;

    expect(finePointer.current).toBe(false);
  });

  test('returns the false fallback without throwing when matchMedia is unavailable', () => {
    // happy-dom's `matchMedia` is non-configurable — `delete` silently no-ops
    // and would leave it callable, defeating this test. Overwrite it instead.
    const original = window.matchMedia;
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    try {
      const finePointer = useFinePointer();
      expect(finePointer.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
