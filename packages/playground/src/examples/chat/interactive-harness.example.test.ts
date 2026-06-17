import { describe, expect, test } from 'bun:test';

import { createHistoryMessageTimestamp } from './interactive-harness-history.ts';

describe('interactive chat harness history timestamps', () => {
  test('keeps generated history timestamps valid beyond thirty pages', () => {
    const timestamp = createHistoryMessageTimestamp(31, 0);

    expect(timestamp).toBe('2026-04-29T12:00:00.000Z');
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });
});
