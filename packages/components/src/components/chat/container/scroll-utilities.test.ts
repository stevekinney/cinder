import { describe, expect, test } from 'bun:test';

import type { Message } from '../conversation-model.ts';
import {
  calculateScrollToBottom,
  calculateUnreadCount,
  DEFAULT_SCROLL_CONFIGURATION,
  extractTimestamp,
  findUnreadBoundaryIndex,
  formatUnreadCount,
  isAtBottom,
  isLargeCount,
  shouldShowJumpToLatest,
  type ScrollState,
} from './scroll-utilities.ts';

const { bottomThreshold, jumpThreshold } = DEFAULT_SCROLL_CONFIGURATION;

function state(scrollTop: number, clientHeight = 600, scrollHeight = 2000): ScrollState {
  return { scrollTop, clientHeight, scrollHeight };
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'assistant',
    content: '',
    position: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

describe('isAtBottom', () => {
  test('returns true when scrolled exactly to the bottom', () => {
    // scrollHeight - scrollTop - clientHeight === 0
    expect(isAtBottom(state(1400), bottomThreshold)).toBe(true);
  });

  test('returns true within the bottomThreshold', () => {
    // distance from bottom = 100, threshold = 150
    expect(isAtBottom(state(1300), bottomThreshold)).toBe(true);
  });

  test('returns false beyond the bottomThreshold', () => {
    // distance from bottom = 151
    expect(isAtBottom(state(1249), bottomThreshold)).toBe(false);
  });

  test('returns true when content fits the viewport (scrollHeight <= clientHeight)', () => {
    // No scroll possible — user is always "at bottom".
    expect(
      isAtBottom({ scrollTop: 0, clientHeight: 600, scrollHeight: 600 }, bottomThreshold),
    ).toBe(true);
  });
});

describe('shouldShowJumpToLatest', () => {
  test('returns false when content fits the viewport', () => {
    expect(
      shouldShowJumpToLatest({ scrollTop: 0, clientHeight: 600, scrollHeight: 500 }, jumpThreshold),
    ).toBe(false);
  });

  test('returns false within the jumpThreshold band (hysteresis with isAtBottom)', () => {
    // distance from bottom = 200, threshold = 200; not strictly greater than
    expect(shouldShowJumpToLatest(state(1200), jumpThreshold)).toBe(false);
  });

  test('returns true when scrolled beyond the jumpThreshold', () => {
    // distance from bottom = 201
    expect(shouldShowJumpToLatest(state(1199), jumpThreshold)).toBe(true);
  });

  test('hysteresis: a position past the bottom threshold but inside the jump threshold shows no button', () => {
    // distance from bottom = 175 — past 150 (no longer "at bottom") but
    // not past 200 (jump button stays hidden). This is the hysteresis band.
    expect(isAtBottom(state(1225), bottomThreshold)).toBe(false);
    expect(shouldShowJumpToLatest(state(1225), jumpThreshold)).toBe(false);
  });
});

describe('isAtBottom + shouldShowJumpToLatest interaction across viewport changes', () => {
  test('expanding content while at bottom keeps isAtBottom true if scrollTop tracks', () => {
    // Start at bottom of 2000px content.
    let s = state(1400, 600, 2000);
    expect(isAtBottom(s, bottomThreshold)).toBe(true);

    // Content grows to 2500px. If the parent re-anchors scrollTop to keep us at bottom,
    // scrollTop becomes 1900 (2500 - 600), distance from bottom = 0.
    s = { scrollTop: 1900, clientHeight: 600, scrollHeight: 2500 };
    expect(isAtBottom(s, bottomThreshold)).toBe(true);
  });

  test('expanding content while at bottom would break stickiness without re-anchoring', () => {
    // Start at bottom of 2000px content.
    let s = state(1400, 600, 2000);
    expect(isAtBottom(s, bottomThreshold)).toBe(true);

    // Content grows to 2500px but scrollTop did NOT advance. distance from bottom = 500.
    s = { scrollTop: 1400, clientHeight: 600, scrollHeight: 2500 };
    expect(isAtBottom(s, bottomThreshold)).toBe(false);
    // The jump button must surface so the user can recover.
    expect(shouldShowJumpToLatest(s, jumpThreshold)).toBe(true);
  });
});

describe('unread message helpers', () => {
  test('calculateUnreadCount returns zero for initial load', () => {
    expect(
      calculateUnreadCount(
        [
          message({ id: 'm1', createdAt: '2026-06-01T00:00:00.000Z' }),
          message({ id: 'm2', createdAt: '2026-06-02T00:00:00.000Z' }),
        ],
        0,
      ),
    ).toBe(0);
  });

  test('calculateUnreadCount counts messages newer than the last-read timestamp', () => {
    const lastReadTimestamp = Date.parse('2026-06-01T12:00:00.000Z');

    expect(
      calculateUnreadCount(
        [
          message({ id: 'read', createdAt: '2026-06-01T00:00:00.000Z' }),
          message({ id: 'unread-a', createdAt: '2026-06-02T00:00:00.000Z' }),
          message({
            id: 'unread-b',
            createdAt: 'not-a-date',
            metadata: { timestamp: '2026-06-03T00:00:00.000Z' },
          }),
          message({ id: 'unknown', createdAt: 'not-a-date', metadata: { timestamp: false } }),
        ],
        lastReadTimestamp,
      ),
    ).toBe(2);
  });

  test('findUnreadBoundaryIndex returns the first unread message index', () => {
    const lastReadTimestamp = Date.parse('2026-06-01T12:00:00.000Z');

    expect(
      findUnreadBoundaryIndex(
        [
          message({ id: 'read', createdAt: '2026-06-01T00:00:00.000Z' }),
          message({ id: 'unread', createdAt: '2026-06-02T00:00:00.000Z' }),
        ],
        lastReadTimestamp,
      ),
    ).toBe(1);
  });

  test('findUnreadBoundaryIndex returns -1 for initial load or fully read messages', () => {
    expect(findUnreadBoundaryIndex([message()], 0)).toBe(-1);
    expect(findUnreadBoundaryIndex([message()], Date.parse('2026-06-02T00:00:00.000Z'))).toBe(-1);
  });
});

describe('timestamp extraction', () => {
  test('extractTimestamp prefers a valid createdAt timestamp', () => {
    expect(extractTimestamp(message({ createdAt: '2026-06-04T00:00:00.000Z' }))).toBe(
      Date.parse('2026-06-04T00:00:00.000Z'),
    );
  });

  test('extractTimestamp falls back to numeric metadata timestamps', () => {
    expect(
      extractTimestamp(message({ createdAt: 'invalid', metadata: { timestamp: 123_456 } })),
    ).toBe(123_456);
  });

  test('extractTimestamp falls back to string metadata timestamps', () => {
    expect(
      extractTimestamp(
        message({
          createdAt: 'invalid',
          metadata: { timestamp: '2026-06-05T00:00:00.000Z' },
        }),
      ),
    ).toBe(Date.parse('2026-06-05T00:00:00.000Z'));
  });

  test('extractTimestamp falls back to the current time for invalid string metadata timestamps', () => {
    const before = Date.now();
    const extracted = extractTimestamp(
      message({ createdAt: 'invalid', metadata: { timestamp: 'not-a-date' } }),
    );
    const after = Date.now();

    expect(extracted).toBeGreaterThanOrEqual(before);
    expect(extracted).toBeLessThanOrEqual(after);
  });

  test('extractTimestamp falls back to the current time when no timestamp is available', () => {
    const before = Date.now();
    const extracted = extractTimestamp(message({ createdAt: 'invalid', metadata: {} }));
    const after = Date.now();

    expect(extracted).toBeGreaterThanOrEqual(before);
    expect(extracted).toBeLessThanOrEqual(after);
  });
});

describe('scroll target and unread badge formatting', () => {
  test('calculateScrollToBottom returns the maximum valid scrollTop', () => {
    expect(calculateScrollToBottom(state(0, 600, 2000))).toBe(1400);
    expect(calculateScrollToBottom(state(0, 600, 400))).toBe(0);
  });

  test('formatUnreadCount hides non-positive counts and caps large counts', () => {
    expect(formatUnreadCount(0)).toBe('');
    expect(formatUnreadCount(-1)).toBe('');
    expect(formatUnreadCount(1)).toBe('1');
    expect(formatUnreadCount(99)).toBe('99');
    expect(formatUnreadCount(100)).toBe('99+');
  });

  test('isLargeCount returns true only above the compact badge threshold', () => {
    expect(isLargeCount(99)).toBe(false);
    expect(isLargeCount(100)).toBe(true);
  });
});
