import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_SCROLL_CONFIGURATION,
  isAtBottom,
  shouldShowJumpToLatest,
  type ScrollState,
} from './scroll-utilities.ts';

const { bottomThreshold, jumpThreshold } = DEFAULT_SCROLL_CONFIGURATION;

function state(scrollTop: number, clientHeight = 600, scrollHeight = 2000): ScrollState {
  return { scrollTop, clientHeight, scrollHeight };
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
