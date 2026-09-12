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

  test('Home and End are unaffected by direction', () => {
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
      // The Page keys resolve to null in either direction, since paging is a pixel
      // move the component makes itself rather than an index this can name.
      expect(
        resolveKeyboardTargetIndex({
          ...base,
          key: 'PageDown',
          orientation: 'horizontal',
          writingDirection,
        }),
      ).toBeNull();
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

describe('resolveKeyboardTargetIndex — paging is not resolved here', () => {
  test('returns null for the Page keys, which move by pixels rather than rows', () => {
    // Deliberate, not an omission. Paging is one uncovered viewport of PIXELS, and an
    // index cannot express that once rows vary in height — any row count returned here
    // is wrong at some boundary, in one direction or the other. Three review rounds
    // found three such boundaries before the model changed. The component scrolls for
    // these keys directly.
    for (const key of ['PageDown', 'PageUp']) {
      expect(
        resolveKeyboardTargetIndex({
          key,
          currentIndex: 50,
          itemCount: 100,
          orientation: 'vertical',
        }),
      ).toBeNull();
    }
  });
});

describe('resolveKeyboardTargetIndex — sticky rows', () => {
  const base = {
    itemCount: 100,
    orientation: 'vertical' as const,
  };

  test('steps over a sticky row on the way down', () => {
    // A sticky header is held at the leading edge while its section is in view, so it
    // is already on screen and scrolling to it moves nothing.
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowDown',
        currentIndex: 9,
        stickyIndexes: new Set([10]),
      }),
    ).toBe(11);
  });

  test('steps over a sticky row on the way up', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowUp',
        currentIndex: 11,
        stickyIndexes: new Set([10]),
      }),
    ).toBe(9);
  });

  test('steps over a run of consecutive sticky rows', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowDown',
        currentIndex: 9,
        stickyIndexes: new Set([10, 11, 12]),
      }),
    ).toBe(13);
  });

  test('holds at the boundary when every row beyond it is sticky', () => {
    // Nothing to reach that way, so the boundary is as close as the reader gets.
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        itemCount: 12,
        key: 'ArrowDown',
        currentIndex: 10,
        stickyIndexes: new Set([11]),
      }),
    ).toBe(11);
  });

  test('applies to the horizontal arrows, in the direction the reader is travelling', () => {
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        orientation: 'horizontal',
        key: 'ArrowRight',
        currentIndex: 9,
        stickyIndexes: new Set([10]),
      }),
    ).toBe(11);
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        orientation: 'horizontal',
        key: 'ArrowLeft',
        currentIndex: 11,
        stickyIndexes: new Set([10]),
      }),
    ).toBe(9);
  });

  test('leaves Home and End on the true ends, sticky or not', () => {
    // These mean "the start" and "the end" of the list, not "the nearest content row".
    const sticky = { ...base, itemCount: 50, stickyIndexes: new Set([0, 49]) };
    expect(resolveKeyboardTargetIndex({ ...sticky, key: 'Home', currentIndex: 20 })).toBe(0);
    expect(resolveKeyboardTargetIndex({ ...sticky, key: 'End', currentIndex: 20 })).toBe(49);
  });

  test('is unchanged when no sticky set is supplied, or it is empty', () => {
    expect(resolveKeyboardTargetIndex({ ...base, key: 'ArrowDown', currentIndex: 9 })).toBe(10);
    expect(
      resolveKeyboardTargetIndex({
        ...base,
        key: 'ArrowDown',
        currentIndex: 9,
        stickyIndexes: new Set<number>(),
      }),
    ).toBe(10);
  });
});
