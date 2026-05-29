import { describe, expect, test } from 'bun:test';

import { optionalContext } from './optional-context.ts';

describe('optionalContext', () => {
  test('returns the value when the strict getter succeeds', () => {
    const value = { tone: 'raised' };
    const get = optionalContext(() => value);
    expect(get()).toBe(value);
  });

  test('returns undefined when the strict getter throws (no provider)', () => {
    const get = optionalContext<{ tone: string }>(() => {
      throw new Error('Context not found');
    });
    expect(get()).toBeUndefined();
  });

  test('does not swallow legitimately falsy values', () => {
    expect(optionalContext(() => 0)()).toBe(0);
    expect(optionalContext(() => '')()).toBe('');
    expect(optionalContext(() => false)()).toBe(false);
    expect(optionalContext<null>(() => null)()).toBeNull();
  });

  test('re-reads the strict getter on every call (no caching)', () => {
    let calls = 0;
    const get = optionalContext(() => {
      calls += 1;
      return calls;
    });
    expect(get()).toBe(1);
    expect(get()).toBe(2);
    expect(get()).toBe(3);
  });

  test('catches a throw on one call and recovers on the next', () => {
    let provided = false;
    const get = optionalContext(() => {
      if (!provided) throw new Error('no provider yet');
      return 'ready';
    });
    expect(get()).toBeUndefined();
    provided = true;
    expect(get()).toBe('ready');
  });
});
