import { describe, expect, test } from 'bun:test';

import {
  computeReconnectDelayMs,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
} from './backoff.ts';

describe('computeReconnectDelayMs', () => {
  test('returns the base delay for the first attempt', () => {
    expect(computeReconnectDelayMs(1)).toBe(RECONNECT_BASE_DELAY_MS);
  });

  test('doubles on each subsequent attempt', () => {
    expect(computeReconnectDelayMs(2)).toBe(RECONNECT_BASE_DELAY_MS * 2);
    expect(computeReconnectDelayMs(3)).toBe(RECONNECT_BASE_DELAY_MS * 4);
    expect(computeReconnectDelayMs(4)).toBe(RECONNECT_BASE_DELAY_MS * 8);
  });

  test('caps at RECONNECT_MAX_DELAY_MS ("capped at 30s", plan §5.1)', () => {
    // 1000 * 2^4 = 16000 (not yet capped) → 2^5 = 32000 (would exceed the cap).
    expect(computeReconnectDelayMs(5)).toBe(16_000);
    expect(computeReconnectDelayMs(6)).toBe(RECONNECT_MAX_DELAY_MS);
    expect(computeReconnectDelayMs(7)).toBe(RECONNECT_MAX_DELAY_MS);
    expect(computeReconnectDelayMs(50)).toBe(RECONNECT_MAX_DELAY_MS);
  });

  test('rejects attempt < 1', () => {
    expect(() => computeReconnectDelayMs(0)).toThrow();
    expect(() => computeReconnectDelayMs(-1)).toThrow();
  });
});
