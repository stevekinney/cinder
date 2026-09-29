import { describe, expect, test } from 'bun:test';

import {
  isReservedKey,
  matchedReservedPrefix,
  WEFT_RESERVED_KEY_PREFIXES,
} from './reserved-prefix.ts';

describe('matchedReservedPrefix', () => {
  test('returns the matched prefix for a reserved key', () => {
    expect(matchedReservedPrefix('wf:order-123')).toBe('wf:');
    expect(matchedReservedPrefix('lease:engine-primary')).toBe('lease:');
  });

  test('returns undefined for an application key', () => {
    expect(matchedReservedPrefix('app:my-service:session')).toBeUndefined();
    expect(matchedReservedPrefix('session:u-8841')).toBeUndefined();
  });

  test('the exported prefix list is non-empty and every entry is checked', () => {
    expect(WEFT_RESERVED_KEY_PREFIXES.length).toBeGreaterThan(0);
    for (const prefix of WEFT_RESERVED_KEY_PREFIXES) {
      expect(matchedReservedPrefix(`${prefix}anything`)).toBe(prefix);
    }
  });
});

describe('isReservedKey', () => {
  test('true for a reserved key, false for an application key', () => {
    expect(isReservedKey('state:workflow-1')).toBe(true);
    expect(isReservedKey('cache:rates:usd')).toBe(false);
  });

  test('false for the empty key', () => {
    expect(isReservedKey('')).toBe(false);
  });
});
