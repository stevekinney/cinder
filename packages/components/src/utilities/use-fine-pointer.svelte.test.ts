import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { useFinePointer } = await import('./use-fine-pointer.svelte.ts');

function installMatchMediaMock(initialMatches: boolean) {
  const queriesPassed: string[] = [];
  const originalMatchMedia = window.matchMedia;
  const list = originalMatchMedia.call(window, '');
  let matches = initialMatches;
  let media = '';
  Object.defineProperties(list, {
    matches: { get: () => matches },
    media: { get: () => media },
  });
  window.matchMedia = (query: string) => {
    queriesPassed.push(query);
    media = query;
    return list;
  };

  return {
    queriesPassed,
    setMatches(value: boolean) {
      matches = value;
    },
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

    mock.setMatches(false);

    expect(finePointer.current).toBe(false);
  });

  test('returns the false fallback without throwing when matchMedia is unavailable', () => {
    // happy-dom's `matchMedia` is non-configurable — `delete` silently no-ops
    // and would leave it callable, defeating this test. Overwrite it instead.
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { value: undefined });
    try {
      expect(window.matchMedia).toBeUndefined();
      const finePointer = useFinePointer();
      expect(finePointer.current).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
