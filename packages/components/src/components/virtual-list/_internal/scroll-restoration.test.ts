import { describe, expect, test } from 'bun:test';

import {
  clearScrollPosition,
  deserializeScrollPosition,
  loadScrollPosition,
  resolveScrollRestorationKey,
  saveScrollPosition,
  serializeScrollPosition,
  type ScrollRestorationStorage,
} from './scroll-restoration.ts';

/** An in-memory `ScrollRestorationStorage` fake, backed by a plain `Map`. */
function createMemoryStorage(): ScrollRestorationStorage & {
  readonly entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/** A `ScrollRestorationStorage` fake whose every method throws, for the private-browsing/quota cases. */
function createThrowingStorage(): ScrollRestorationStorage {
  return {
    getItem: () => {
      throw new Error('getItem is not allowed');
    },
    setItem: () => {
      throw new Error('setItem is not allowed');
    },
    removeItem: () => {
      throw new Error('removeItem is not allowed');
    },
  };
}

describe('resolveScrollRestorationKey', () => {
  test('namespaces the id under the stable prefix', () => {
    expect(resolveScrollRestorationKey('inbox-list')).toBe('cinder:virtual-list:inbox-list');
  });

  test('returns null for an empty id', () => {
    expect(resolveScrollRestorationKey('')).toBeNull();
  });

  test('returns null for a whitespace-only id', () => {
    expect(resolveScrollRestorationKey('   ')).toBeNull();
  });
});

describe('serializeScrollPosition', () => {
  test('serializes to JSON', () => {
    expect(serializeScrollPosition({ scrollOffset: 120, startIndex: 4 })).toBe(
      '{"scrollOffset":120,"startIndex":4}',
    );
  });
});

describe('deserializeScrollPosition', () => {
  test('round-trips a value serializeScrollPosition produced', () => {
    const serialized = serializeScrollPosition({ scrollOffset: 240, startIndex: 8 });
    expect(deserializeScrollPosition(serialized)).toEqual({ scrollOffset: 240, startIndex: 8 });
  });

  test('returns null for a null input', () => {
    expect(deserializeScrollPosition(null)).toBeNull();
  });

  test('returns null for the string "null" (valid JSON, not an object)', () => {
    expect(deserializeScrollPosition('null')).toBeNull();
  });

  test('returns null for a JSON array', () => {
    expect(deserializeScrollPosition('[]')).toBeNull();
  });

  test('returns null for a JSON primitive that is not an object', () => {
    expect(deserializeScrollPosition('42')).toBeNull();
  });

  test('returns null for truncated, unparseable JSON', () => {
    expect(deserializeScrollPosition('{"scrollOffset":12,"startIn')).toBeNull();
  });

  test('returns null when a field is missing', () => {
    expect(deserializeScrollPosition('{"scrollOffset":12}')).toBeNull();
  });

  test('returns null when a field is a non-numeric type', () => {
    expect(deserializeScrollPosition('{"scrollOffset":"5","startIndex":0}')).toBeNull();
  });

  test('returns null when a field is negative', () => {
    expect(deserializeScrollPosition('{"scrollOffset":-1,"startIndex":0}')).toBeNull();
  });

  test('returns null when a field is non-finite', () => {
    // JSON has no literal token for NaN or Infinity — `JSON.parse` rejects
    // unquoted `NaN`/`Infinity` as a syntax error before a value ever
    // reaches the numeric-field guard. An exponent large enough to overflow
    // IEEE-754 double range (`1e400`) IS valid JSON syntax, and parses to
    // `Infinity`, so it is what actually exercises the `Number.isFinite`
    // guard that also stands between a would-be NaN and the caller.
    expect(deserializeScrollPosition('{"scrollOffset":1e400,"startIndex":0}')).toBeNull();
  });
});

describe('saveScrollPosition', () => {
  test('writes the serialized position under the resolved key', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, 'inbox-list', { scrollOffset: 100, startIndex: 2 });
    expect(storage.entries.get('cinder:virtual-list:inbox-list')).toBe(
      '{"scrollOffset":100,"startIndex":2}',
    );
  });

  test('is a no-op when storage is undefined', () => {
    // Nothing to assert against, but this must not throw during server
    // rendering, where no storage is passed at all.
    expect(() =>
      saveScrollPosition(undefined, 'inbox-list', { scrollOffset: 100, startIndex: 2 }),
    ).not.toThrow();
  });

  test('writes nothing for an empty id', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, '', { scrollOffset: 100, startIndex: 2 });
    expect(storage.entries.size).toBe(0);
  });

  test('writes nothing for a whitespace-only id', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, '   ', { scrollOffset: 100, startIndex: 2 });
    expect(storage.entries.size).toBe(0);
  });

  test('swallows a throwing setItem instead of propagating', () => {
    const storage = createThrowingStorage();
    expect(() =>
      saveScrollPosition(storage, 'inbox-list', { scrollOffset: 100, startIndex: 2 }),
    ).not.toThrow();
  });
});

describe('loadScrollPosition', () => {
  test('round-trips a position saved with saveScrollPosition', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, 'inbox-list', { scrollOffset: 360, startIndex: 12 });
    expect(loadScrollPosition(storage, 'inbox-list')).toEqual({
      scrollOffset: 360,
      startIndex: 12,
    });
  });

  test('returns null when nothing was saved for the id', () => {
    const storage = createMemoryStorage();
    expect(loadScrollPosition(storage, 'inbox-list')).toBeNull();
  });

  test('returns null when storage is undefined', () => {
    expect(loadScrollPosition(undefined, 'inbox-list')).toBeNull();
  });

  test('returns null for an empty id without reading storage', () => {
    const storage = createMemoryStorage();
    expect(loadScrollPosition(storage, '')).toBeNull();
  });

  test('returns null for a whitespace-only id without reading storage', () => {
    const storage = createMemoryStorage();
    expect(loadScrollPosition(storage, '   ')).toBeNull();
  });

  test('swallows a throwing getItem and returns null instead of propagating', () => {
    const storage = createThrowingStorage();
    expect(loadScrollPosition(storage, 'inbox-list')).toBeNull();
  });
});

describe('clearScrollPosition', () => {
  test('removes a previously-saved position', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, 'inbox-list', { scrollOffset: 100, startIndex: 2 });
    clearScrollPosition(storage, 'inbox-list');
    expect(storage.entries.has('cinder:virtual-list:inbox-list')).toBe(false);
  });

  test('is a no-op when storage is undefined', () => {
    expect(() => clearScrollPosition(undefined, 'inbox-list')).not.toThrow();
  });

  test('touches nothing for an empty id', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, 'other-list', { scrollOffset: 100, startIndex: 2 });
    clearScrollPosition(storage, '');
    expect(storage.entries.size).toBe(1);
  });

  test('touches nothing for a whitespace-only id', () => {
    const storage = createMemoryStorage();
    saveScrollPosition(storage, 'other-list', { scrollOffset: 100, startIndex: 2 });
    clearScrollPosition(storage, '   ');
    expect(storage.entries.size).toBe(1);
  });

  test('swallows a throwing removeItem instead of propagating', () => {
    const storage = createThrowingStorage();
    expect(() => clearScrollPosition(storage, 'inbox-list')).not.toThrow();
  });
});
