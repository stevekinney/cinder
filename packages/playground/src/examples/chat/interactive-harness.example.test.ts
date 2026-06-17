import { describe, expect, test } from 'bun:test';

const harnessModule = (await import('./interactive-harness.example.svelte')) as unknown as {
  createHistoryMessageTimestamp: (page: number, index: number) => string;
};
const { createHistoryMessageTimestamp } = harnessModule;

describe('interactive chat harness history timestamps', () => {
  test('keeps generated history timestamps valid beyond thirty pages', () => {
    const timestamp = createHistoryMessageTimestamp(31, 0);

    expect(timestamp).toBe('2026-04-29T12:00:00.000Z');
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false);
  });
});
