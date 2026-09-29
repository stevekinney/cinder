import { describe, expect, test } from 'bun:test';

import {
  buildStartOptions,
  EMPTY_ADVANCED_START_OPTIONS,
  parseRawPayload,
} from './start-wizard-state.ts';

describe('buildStartOptions', () => {
  test('an all-blank form produces an empty options object', () => {
    expect(buildStartOptions(EMPTY_ADVANCED_START_OPTIONS)).toEqual({});
  });

  test('trims and includes only populated fields', () => {
    const options = buildStartOptions({
      id: '  greeting-2026-04-29  ',
      idempotencyKey: '  key-1  ',
      tags: ['nightly', 'ops'],
      searchAttributes: [],
      executionTimeout: '  1h  ',
    });
    expect(options).toEqual({
      id: 'greeting-2026-04-29',
      idempotencyKey: 'key-1',
      tags: ['nightly', 'ops'],
      executionTimeout: '1h',
    });
  });

  test('infers search attribute value types and drops blank-key rows', () => {
    const options = buildStartOptions({
      ...EMPTY_ADVANCED_START_OPTIONS,
      searchAttributes: [
        { key: 'customerTier', value: 'gold' },
        { key: 'retryCount', value: '3' },
        { key: 'expedited', value: 'true' },
        { key: '', value: 'ignored' },
      ],
    });
    expect(options.searchAttributes).toEqual({
      customerTier: 'gold',
      retryCount: 3,
      expedited: true,
    });
  });

  test('an empty search-attribute row set omits searchAttributes entirely', () => {
    const options = buildStartOptions(EMPTY_ADVANCED_START_OPTIONS);
    expect(options.searchAttributes).toBeUndefined();
  });
});

describe('parseRawPayload', () => {
  test('empty/whitespace input parses to null', () => {
    expect(parseRawPayload('')).toEqual({ ok: true, value: null });
    expect(parseRawPayload('   \n  ')).toEqual({ ok: true, value: null });
  });

  test('valid JSON parses to its value', () => {
    expect(parseRawPayload('{"orderId":"ord-1"}')).toEqual({
      ok: true,
      value: { orderId: 'ord-1' },
    });
  });

  test('invalid JSON reports an error message', () => {
    const result = parseRawPayload('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});
