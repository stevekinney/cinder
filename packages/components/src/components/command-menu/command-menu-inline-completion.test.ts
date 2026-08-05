/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  computeGhostOverlayFontStyle,
  computeGhostRemainder,
} from './command-menu-inline-completion.svelte.ts';

setupHappyDom();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('computeGhostRemainder', () => {
  test('returns the case-preserved remainder of a prefix-matching value', () => {
    expect(computeGhostRemainder('al', 'alpha')).toBe('pha');
  });

  test("matches case-insensitively but preserves the active value's own casing", () => {
    // The user typed uppercase; the remainder still reads in the item's
    // own casing — see command-menu.a11y.md (b) for why hosts must append
    // this rather than replacing the whole token with `value`.
    expect(computeGhostRemainder('AL', 'alpha')).toBe('pha');
  });

  test('returns empty for a null active value', () => {
    expect(computeGhostRemainder('al', null)).toBe('');
  });

  test('returns empty when the value does not prefix-match the query', () => {
    expect(computeGhostRemainder('be', 'alpha')).toBe('');
  });

  test('returns empty when the value equals the query — nothing left to complete', () => {
    expect(computeGhostRemainder('alpha', 'alpha')).toBe('');
  });

  test('returns the full value for an empty query — not a special case', () => {
    expect(computeGhostRemainder('', 'alpha')).toBe('alpha');
  });
});

describe('computeGhostOverlayFontStyle', () => {
  test('copies font and color properties from the computed style', () => {
    const element = document.createElement('textarea');
    element.style.fontFamily = 'Menlo';
    element.style.fontSize = '14px';
    document.body.append(element);

    const style = computeGhostOverlayFontStyle(element);

    expect(style).toContain('font-family:');
    expect(style).toContain('font-size:');
    expect(style).toContain('color:');
  });

  test('returns an empty string when getComputedStyle is unavailable', () => {
    const original = globalThis.getComputedStyle;
    // @ts-expect-error — simulating an environment without getComputedStyle.
    globalThis.getComputedStyle = undefined;
    try {
      const element = document.createElement('textarea');
      expect(computeGhostOverlayFontStyle(element)).toBe('');
    } finally {
      globalThis.getComputedStyle = original;
    }
  });
});
