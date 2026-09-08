import { describe, expect, test } from 'bun:test';

import { resolveKeyboardTargetIndex, resolveRowSemantics } from './list-semantics.ts';

describe('resolveRowSemantics', () => {
  test('adds 1 to a zero-based index rather than passing it through unchanged', () => {
    // A regression that passed the zero-based index straight through would
    // report ariaPosInSet 0 here, not 1 — asserting the exact 1-based value,
    // rather than merely that a number came back, is what makes that visible.
    expect(resolveRowSemantics(0, 10)).toEqual({ ariaPosInSet: 1, ariaSetSize: 10 });
  });

  test('reports the 1-based position for a middle row', () => {
    expect(resolveRowSemantics(4, 10)).toEqual({ ariaPosInSet: 5, ariaSetSize: 10 });
  });

  test('reports the 1-based position for the last row', () => {
    expect(resolveRowSemantics(9, 10)).toEqual({ ariaPosInSet: 10, ariaSetSize: 10 });
  });

  test('ariaSetSize is the full logical item count, not a shorter rendered-window length', () => {
    // A virtualized list of 10,000 items only ever mounts a small window — this
    // proves ariaSetSize reports the full count regardless of how few rows a
    // caller happens to have mounted around this one.
    expect(resolveRowSemantics(2, 10_000)).toEqual({ ariaPosInSet: 3, ariaSetSize: 10_000 });
  });
});

describe('resolveKeyboardTargetIndex', () => {
  const baseOptions = {
    currentIndex: 5,
    itemCount: 10,
    visibleCount: 4,
  };

  describe('vertical orientation', () => {
    test('ArrowDown moves forward by one', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'ArrowDown', orientation: 'vertical' }),
      ).toBe(6);
    });

    test('ArrowUp moves backward by one', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'ArrowUp', orientation: 'vertical' }),
      ).toBe(4);
    });

    test('ArrowLeft is not a navigation key on the vertical axis', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'ArrowLeft', orientation: 'vertical' }),
      ).toBeNull();
    });

    test('ArrowRight is not a navigation key on the vertical axis', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'ArrowRight', orientation: 'vertical' }),
      ).toBeNull();
    });

    test('Home moves to index 0', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'Home', orientation: 'vertical' }),
      ).toBe(0);
    });

    test('End moves to the last index', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'End', orientation: 'vertical' }),
      ).toBe(9);
    });

    test('PageDown moves forward by visibleCount', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'PageDown', orientation: 'vertical' }),
      ).toBe(9);
    });

    test('PageUp moves backward by visibleCount', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'PageUp', orientation: 'vertical' }),
      ).toBe(1);
    });
  });

  describe('horizontal orientation', () => {
    test('ArrowRight moves forward by one', () => {
      expect(
        resolveKeyboardTargetIndex({
          ...baseOptions,
          key: 'ArrowRight',
          orientation: 'horizontal',
        }),
      ).toBe(6);
    });

    test('ArrowLeft moves backward by one', () => {
      expect(
        resolveKeyboardTargetIndex({
          ...baseOptions,
          key: 'ArrowLeft',
          orientation: 'horizontal',
        }),
      ).toBe(4);
    });

    test('ArrowUp is not a navigation key on the horizontal axis', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'ArrowUp', orientation: 'horizontal' }),
      ).toBeNull();
    });

    test('ArrowDown is not a navigation key on the horizontal axis', () => {
      expect(
        resolveKeyboardTargetIndex({
          ...baseOptions,
          key: 'ArrowDown',
          orientation: 'horizontal',
        }),
      ).toBeNull();
    });

    test('Home moves to index 0', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'Home', orientation: 'horizontal' }),
      ).toBe(0);
    });

    test('End moves to the last index', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'End', orientation: 'horizontal' }),
      ).toBe(9);
    });

    test('PageDown moves forward by visibleCount', () => {
      expect(
        resolveKeyboardTargetIndex({
          ...baseOptions,
          key: 'PageDown',
          orientation: 'horizontal',
        }),
      ).toBe(9);
    });

    test('PageUp moves backward by visibleCount', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'PageUp', orientation: 'horizontal' }),
      ).toBe(1);
    });
  });

  describe('clamping at the edges', () => {
    test('a forward move already at the last index stays there rather than overshooting', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'ArrowDown',
          currentIndex: 9,
          itemCount: 10,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBe(9);
    });

    test('a backward move already at index 0 stays there rather than going negative', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'ArrowUp',
          currentIndex: 0,
          itemCount: 10,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBe(0);
    });

    test('PageDown clamps to the last index instead of overshooting past it', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageDown',
          currentIndex: 8,
          itemCount: 10,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBe(9);
    });

    test('PageUp clamps to 0 instead of going negative', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageUp',
          currentIndex: 1,
          itemCount: 10,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBe(0);
    });

    test('a no-op move still returns the unchanged index rather than null', () => {
      // The component needs to tell "not a navigation key" (leave the event
      // alone) apart from "navigation key, but already at the boundary"
      // (consume the event anyway) — null would collapse that distinction.
      const result = resolveKeyboardTargetIndex({
        key: 'ArrowDown',
        currentIndex: 9,
        itemCount: 10,
        visibleCount: 4,
        orientation: 'vertical',
      });
      expect(result).not.toBeNull();
      expect(result).toBe(9);
    });
  });

  describe('non-navigation keys', () => {
    test('returns null for a key the list does not handle', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'a', orientation: 'vertical' }),
      ).toBeNull();
    });

    test('returns null for Tab', () => {
      expect(
        resolveKeyboardTargetIndex({ ...baseOptions, key: 'Tab', orientation: 'vertical' }),
      ).toBeNull();
    });
  });

  describe('itemCount edge cases', () => {
    test('returns null for every key when itemCount is 0, including Home', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'Home',
          currentIndex: 0,
          itemCount: 0,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBeNull();
    });

    test('returns null for every key when itemCount is 0, including a plain arrow key', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'ArrowDown',
          currentIndex: 0,
          itemCount: 0,
          visibleCount: 4,
          orientation: 'vertical',
        }),
      ).toBeNull();
    });

    test('a single-item list resolves every navigation key to the only index, 0', () => {
      const single = {
        currentIndex: 0,
        itemCount: 1,
        visibleCount: 4,
        orientation: 'vertical' as const,
      };
      expect(resolveKeyboardTargetIndex({ ...single, key: 'Home' })).toBe(0);
      expect(resolveKeyboardTargetIndex({ ...single, key: 'End' })).toBe(0);
      expect(resolveKeyboardTargetIndex({ ...single, key: 'ArrowDown' })).toBe(0);
      expect(resolveKeyboardTargetIndex({ ...single, key: 'ArrowUp' })).toBe(0);
      expect(resolveKeyboardTargetIndex({ ...single, key: 'PageDown' })).toBe(0);
      expect(resolveKeyboardTargetIndex({ ...single, key: 'PageUp' })).toBe(0);
    });
  });

  describe('visibleCount of 0 or less', () => {
    test('PageDown still advances by at least 1 when visibleCount is 0', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageDown',
          currentIndex: 5,
          itemCount: 10,
          visibleCount: 0,
          orientation: 'vertical',
        }),
      ).toBe(6);
    });

    test('PageUp still retreats by at least 1 when visibleCount is 0', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageUp',
          currentIndex: 5,
          itemCount: 10,
          visibleCount: 0,
          orientation: 'vertical',
        }),
      ).toBe(4);
    });

    test('PageDown still advances by at least 1 when visibleCount is negative', () => {
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageDown',
          currentIndex: 5,
          itemCount: 10,
          visibleCount: -3,
          orientation: 'vertical',
        }),
      ).toBe(6);
    });

    test('floors a fractional visibleCount rather than moving by a fractional step', () => {
      // A real caller computes visibleCount as viewportSize / itemHeight, which is
      // fractional in the ordinary case, not just at the 0-or-less edge above — an
      // unfloored step here would resolve to a fractional target index.
      expect(
        resolveKeyboardTargetIndex({
          key: 'PageDown',
          currentIndex: 0,
          itemCount: 10,
          visibleCount: 4.9,
          orientation: 'vertical',
        }),
      ).toBe(4);
    });
  });
});

describe('resolveKeyboardTargetIndex — right-to-left', () => {
  // `KeyboardEvent.key` is not remapped by `dir`, and the component lays horizontal
  // rows out with logical properties — so under RTL a higher index sits visually to
  // the LEFT, and the left arrow is the one that moves the reader forward. WAI-ARIA
  // Authoring Practices: "if the direction is RTL, Right Arrow performs as Left
  // Arrow and vice versa."
  const base = { currentIndex: 5, itemCount: 10, visibleCount: 4 } as const;

  test('ArrowLeft moves forward in a right-to-left horizontal list', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowLeft',
        orientation: 'horizontal',
        writingDirection: 'rtl',
      }),
    ).toBe(6);
  });

  test('ArrowRight moves backward in a right-to-left horizontal list', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowRight',
        orientation: 'horizontal',
        writingDirection: 'rtl',
      }),
    ).toBe(4);
  });

  test('left-to-right keeps the natural mapping', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowRight',
        orientation: 'horizontal',
        writingDirection: 'ltr',
      }),
    ).toBe(6);
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowLeft',
        orientation: 'horizontal',
        writingDirection: 'ltr',
      }),
    ).toBe(4);
  });

  test('an omitted writingDirection behaves as left-to-right', () => {
    expect(
      resolveKeyboardTargetIndex({ ...base, key: 'ArrowRight', orientation: 'horizontal' }),
    ).toBe(6);
  });

  test('the block axis does not flip, so a vertical list ignores the direction', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowDown',
        orientation: 'vertical',
        writingDirection: 'rtl',
      }),
    ).toBe(6);
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowUp',
        orientation: 'vertical',
        writingDirection: 'rtl',
      }),
    ).toBe(4);
  });

  test('Home, End, and the Page keys are unaffected by direction', () => {
    for (const writingDirection of ['ltr', 'rtl'] as const) {
      expect(
        resolveKeyboardTargetIndex({
          ...base,
          key: 'Home',
          orientation: 'horizontal',
          writingDirection,
        }),
      ).toBe(0);
      expect(
        resolveKeyboardTargetIndex({
          ...base,
          key: 'End',
          orientation: 'horizontal',
          writingDirection,
        }),
      ).toBe(9);
      expect(
        resolveKeyboardTargetIndex({
          ...base,
          key: 'PageDown',
          orientation: 'horizontal',
          writingDirection,
        }),
      ).toBe(9);
    }
  });

  test('horizontal still ignores the block-axis arrows in both directions', () => {
    for (const writingDirection of ['ltr', 'rtl'] as const) {
      expect(
        resolveKeyboardTargetIndex({
          ...base,
          key: 'ArrowDown',
          orientation: 'horizontal',
          writingDirection,
        }),
      ).toBeNull();
    }
  });
});
