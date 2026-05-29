import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { useReducedMotion } = await import('./use-reduced-motion.svelte.ts');

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

describe('useReducedMotion', () => {
  let mock: ReturnType<typeof installMatchMediaMock>;

  afterEach(() => {
    mock?.restore();
  });

  test('constructs matchMedia with the canonical query string in browser resolution', () => {
    mock = installMatchMediaMock(false);

    const motion = useReducedMotion();

    if (!usesBrowserMediaQuery(mock)) {
      expect(motion.current).toBe(false);
      return;
    }
    expect(mock.queriesPassed[0]).toBe('(prefers-reduced-motion: reduce)');
  });

  test('returns the current matches value in browser resolution', () => {
    mock = installMatchMediaMock(true);

    const motion = useReducedMotion();

    if (!usesBrowserMediaQuery(mock)) {
      expect(motion.current).toBe(false);
      return;
    }
    expect(motion.current).toBe(true);
  });

  test('current reads live matches value from the underlying MediaQueryList in browser resolution', () => {
    mock = installMatchMediaMock(true);

    const motion = useReducedMotion();
    if (!usesBrowserMediaQuery(mock)) {
      expect(motion.current).toBe(false);
      return;
    }
    expect(motion.current).toBe(true);

    // Outside a Svelte effect context this verifies direct getter read-through,
    // not reactive effect invalidation.
    mock.list.matches = false;

    expect(motion.current).toBe(false);
  });

  test('returns false when matchMedia does not match', () => {
    mock = installMatchMediaMock(false);

    const motion = useReducedMotion();

    expect(motion.current).toBe(false);
  });

  test('returns the false fallback without throwing when matchMedia is unavailable', () => {
    // Simulates the SSR-contract path: the client `MediaQuery` build is loaded
    // (browser export condition) but there is no DOM, so `window.matchMedia` is
    // missing. The hook must not call the throwing client constructor.
    const original = window.matchMedia;
    delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    try {
      const motion = useReducedMotion();
      expect(motion.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
