import { describe, expect, test } from 'bun:test';

import {
  classifyItemGrowth,
  resolveReversePinTarget,
  shouldPinToEnd,
  type ItemGrowth,
  type ReversePinMode,
} from './reverse-order.ts';

describe('classifyItemGrowth', () => {
  test('reports unchanged for identical non-empty key sequences', () => {
    const result = classifyItemGrowth(['msg-1', 'msg-2', 'msg-3'], ['msg-1', 'msg-2', 'msg-3']);
    expect(result).toEqual({ kind: 'unchanged' });
  });

  test('reports unchanged for two empty key sequences', () => {
    const result = classifyItemGrowth([], []);
    expect(result).toEqual({ kind: 'unchanged' });
  });

  test('reports appended when previousKeys is a strict prefix of nextKeys', () => {
    // The FIRST key ('msg-1') survives untouched and new keys land at the END —
    // the defining shape of a real append. If the prefix/suffix checks were
    // swapped, this would be misclassified as 'prepended' instead.
    const result = classifyItemGrowth(['msg-1', 'msg-2'], ['msg-1', 'msg-2', 'msg-3']);
    expect(result).toEqual({ kind: 'appended', appendedCount: 1 });
  });

  test('reports the correct appendedCount for a multi-item append', () => {
    const result = classifyItemGrowth(['msg-1'], ['msg-1', 'msg-2', 'msg-3', 'msg-4']);
    expect(result).toEqual({ kind: 'appended', appendedCount: 3 });
  });

  test('reports prepended when previousKeys is a strict suffix of nextKeys', () => {
    // The LAST key ('msg-3') survives untouched and new keys land at the START —
    // the defining shape of loading older history. If the prefix/suffix checks
    // were swapped, this would be misclassified as 'appended' instead.
    const result = classifyItemGrowth(['msg-2', 'msg-3'], ['msg-1', 'msg-2', 'msg-3']);
    expect(result).toEqual({ kind: 'prepended', prependedCount: 1 });
  });

  test('reports the correct prependedCount for a multi-item prepend', () => {
    const result = classifyItemGrowth(['msg-4'], ['msg-1', 'msg-2', 'msg-3', 'msg-4']);
    expect(result).toEqual({ kind: 'prepended', prependedCount: 3 });
  });

  test('distinguishes append from prepend using the same previousKeys length', () => {
    // Same starting length and same growth amount on both sides — the only thing
    // that differs is WHICH end previousKeys survives at. This pair fails together
    // if the prefix/suffix checks are ever swapped.
    const previousKeys = ['msg-2', 'msg-3'];
    const appended = classifyItemGrowth(previousKeys, ['msg-2', 'msg-3', 'msg-4']);
    const prepended = classifyItemGrowth(previousKeys, ['msg-1', 'msg-2', 'msg-3']);

    expect(appended).toEqual({ kind: 'appended', appendedCount: 1 });
    expect(prepended).toEqual({ kind: 'prepended', prependedCount: 1 });
  });

  test('reports appended for an empty previousKeys against a non-empty nextKeys', () => {
    // An empty array is trivially both a prefix and a suffix of anything, so this
    // is the tie-break case: prefix wins (see the next test for the general rule).
    const result = classifyItemGrowth([], ['msg-1', 'msg-2']);
    expect(result).toEqual({ kind: 'appended', appendedCount: 2 });
  });

  test('breaks a prefix/suffix tie in favor of appended', () => {
    // previousKeys ['a'] is simultaneously a prefix AND a suffix of nextKeys
    // ['a', 'a'] — the documented tie-break picks 'appended', because a chat
    // transcript grows by new messages far more often than by history pages, and
    // 'prepended' callers treat the growth as "must not disturb scroll position,"
    // which is the wrong assumption for the common case.
    const result = classifyItemGrowth(['a'], ['a', 'a']);
    expect(result).toEqual({ kind: 'appended', appendedCount: 1 });
  });

  test('reports replaced for equal-length but different key sequences', () => {
    const result = classifyItemGrowth(['msg-1', 'msg-2'], ['msg-1', 'msg-3']);
    expect(result).toEqual({ kind: 'replaced' });
  });

  test('reports replaced for a same-length reorder', () => {
    const result = classifyItemGrowth(['msg-1', 'msg-2'], ['msg-2', 'msg-1']);
    expect(result).toEqual({ kind: 'replaced' });
  });

  test('reports replaced when nextKeys is non-empty but shorter than previousKeys', () => {
    // A shrink can never satisfy the strictly-longer requirement for either
    // 'appended' or 'prepended', even though ['msg-1', 'msg-2'] IS a prefix of
    // previousKeys read the other direction.
    const result = classifyItemGrowth(['msg-1', 'msg-2', 'msg-3'], ['msg-1', 'msg-2']);
    expect(result).toEqual({ kind: 'replaced' });
  });

  test('reports replaced when nextKeys is empty and previousKeys is non-empty', () => {
    const result = classifyItemGrowth(['msg-1', 'msg-2'], []);
    expect(result).toEqual({ kind: 'replaced' });
  });

  test('reports replaced for a mixed prepend+append that is neither a pure prefix nor a pure suffix extension', () => {
    const result = classifyItemGrowth(['msg-2', 'msg-3'], ['msg-1', 'msg-2', 'msg-3', 'msg-4']);
    expect(result).toEqual({ kind: 'replaced' });
  });

  test('reports replaced for a longer, entirely disjoint nextKeys', () => {
    const result = classifyItemGrowth(['msg-1'], ['msg-2', 'msg-3']);
    expect(result).toEqual({ kind: 'replaced' });
  });
});

describe('resolveReversePinTarget', () => {
  test('returns totalSize minus viewportSize when content overflows the viewport', () => {
    expect(resolveReversePinTarget({ totalSize: 1000, viewportSize: 400 })).toBe(600);
  });

  test('returns 0 when content is shorter than the viewport', () => {
    expect(resolveReversePinTarget({ totalSize: 200, viewportSize: 400 })).toBe(0);
  });

  test('returns 0 when content exactly fills the viewport', () => {
    expect(resolveReversePinTarget({ totalSize: 400, viewportSize: 400 })).toBe(0);
  });

  test('returns totalSize when the viewport has zero size', () => {
    expect(resolveReversePinTarget({ totalSize: 750, viewportSize: 0 })).toBe(750);
  });

  test('returns 0 for empty content regardless of viewport size', () => {
    expect(resolveReversePinTarget({ totalSize: 0, viewportSize: 400 })).toBe(0);
  });
});

describe('shouldPinToEnd', () => {
  const appended: ItemGrowth = { kind: 'appended', appendedCount: 1 };
  const prepended: ItemGrowth = { kind: 'prepended', prependedCount: 1 };
  const unchanged: ItemGrowth = { kind: 'unchanged' };
  const replaced: ItemGrowth = { kind: 'replaced' };

  describe('mode "reverse"', () => {
    const mode: ReversePinMode = 'reverse';

    test('pins on appended growth even when the reader has scrolled away from the end', () => {
      // This is the entire behavioral difference from 'stick-to-bottom': reverse
      // pins unconditionally on append.
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: false })).toBe(true);
    });

    test('pins on appended growth when already at the end', () => {
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: true })).toBe(true);
    });

    test('never pins on prepended growth, regardless of scroll position', () => {
      expect(shouldPinToEnd({ mode, growth: prepended, isAtEnd: true })).toBe(false);
      expect(shouldPinToEnd({ mode, growth: prepended, isAtEnd: false })).toBe(false);
    });

    test('never pins on unchanged growth', () => {
      expect(shouldPinToEnd({ mode, growth: unchanged, isAtEnd: false })).toBe(false);
    });

    test('never pins on replaced growth', () => {
      expect(shouldPinToEnd({ mode, growth: replaced, isAtEnd: false })).toBe(false);
    });
  });

  describe('mode "stick-to-bottom"', () => {
    const mode: ReversePinMode = 'stick-to-bottom';

    test('pins on appended growth only when already at the end', () => {
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: true })).toBe(true);
    });

    test('does not pin on appended growth when scrolled away from the end', () => {
      // This is the entire behavioral difference from 'reverse'.
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: false })).toBe(false);
    });

    test('never pins on prepended growth, regardless of scroll position', () => {
      expect(shouldPinToEnd({ mode, growth: prepended, isAtEnd: true })).toBe(false);
      expect(shouldPinToEnd({ mode, growth: prepended, isAtEnd: false })).toBe(false);
    });

    test('never pins on unchanged growth', () => {
      expect(shouldPinToEnd({ mode, growth: unchanged, isAtEnd: true })).toBe(false);
    });

    test('never pins on replaced growth', () => {
      expect(shouldPinToEnd({ mode, growth: replaced, isAtEnd: true })).toBe(false);
    });
  });

  describe('mode "none"', () => {
    const mode: ReversePinMode = 'none';

    test('never pins, even on appended growth at the end', () => {
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: true })).toBe(false);
      expect(shouldPinToEnd({ mode, growth: appended, isAtEnd: false })).toBe(false);
    });

    test('never pins on prepended, unchanged, or replaced growth', () => {
      expect(shouldPinToEnd({ mode, growth: prepended, isAtEnd: true })).toBe(false);
      expect(shouldPinToEnd({ mode, growth: unchanged, isAtEnd: true })).toBe(false);
      expect(shouldPinToEnd({ mode, growth: replaced, isAtEnd: true })).toBe(false);
    });
  });
});
