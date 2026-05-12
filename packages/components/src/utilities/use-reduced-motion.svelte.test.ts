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
  const listeners = new Set<Listener>();

  const list: FakeMediaQueryList = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
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
    setMatches(next: boolean) {
      list.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
    restore() {
      window.matchMedia = originalMatchMedia;
    },
  };
}

describe('useReducedMotion', () => {
  let mock: ReturnType<typeof installMatchMediaMock>;

  afterEach(() => {
    mock?.restore();
  });

  test('constructs matchMedia with the canonical query string', () => {
    mock = installMatchMediaMock(false);

    useReducedMotion();

    expect(mock.queriesPassed[0]).toBe('(prefers-reduced-motion: reduce)');
  });

  test('returns the current matches value', () => {
    mock = installMatchMediaMock(true);

    const motion = useReducedMotion();

    expect(motion.current).toBe(true);
  });

  test('current reads live matches value from the underlying MediaQueryList', () => {
    mock = installMatchMediaMock(true);

    const motion = useReducedMotion();
    expect(motion.current).toBe(true);

    // Outside a Svelte effect context no change listener is registered, so
    // setMatches would fire into empty listeners. Mutate the list directly
    // to verify the getter reads through to the live matches property.
    mock.list.matches = false;

    expect(motion.current).toBe(false);
  });

  test('returns false when matchMedia does not match', () => {
    mock = installMatchMediaMock(false);

    const motion = useReducedMotion();

    expect(motion.current).toBe(false);
  });
});
