import { afterEach, describe, expect, test } from 'bun:test';

import {
  classifyRtlScrollType,
  domWritingDirectionReader,
  normalizeInlineScrollOffset,
  resolveAbsoluteRowStyle,
  resolveObservedMainAxisSize,
  resolveRowLayoutDescriptor,
  resolveWritingDirection,
  type WritingDirectionReader,
} from './geometry.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('resolveWritingDirection', () => {
  test(`returns rtl when the injected reader's computed direction is rtl, even with a conflicting dir="ltr" ancestor`, () => {
    // The whole point of the injectable reader: this priority rule (computed
    // style wins over a conflicting dir attribute) cannot be demonstrated
    // through a hard-coded getComputedStyle call under happy-dom, where the
    // two signals always agree.
    const reader: WritingDirectionReader = {
      getComputedDirection: () => 'rtl',
      closestDirAttribute: () => 'ltr',
    };
    const element = document.createElement('div');

    expect(resolveWritingDirection(element, reader)).toBe('rtl');
  });

  test('lets an explicit computed ltr win over a conflicting dir="rtl" ancestor', () => {
    // CIN-192's priority rule. The earlier implementation fell through to the
    // attribute on anything that was not 'rtl', so an element with an explicit
    // `direction: ltr` override inside a `dir="rtl"` ancestor was reported as rtl —
    // the opposite of what the browser renders.
    const reader = {
      getComputedDirection: () => 'ltr',
      closestDirAttribute: () => 'rtl',
    };

    expect(resolveWritingDirection(document.createElement('div'), reader)).toBe('ltr');
  });

  test('falls back to the [dir] ancestor only when computed style answers nothing', () => {
    // A detached element, or an environment that does not compute style, leaves the
    // attribute as the only signal available.
    const reader = {
      getComputedDirection: () => '',
      closestDirAttribute: () => 'rtl',
    };

    expect(resolveWritingDirection(document.createElement('div'), reader)).toBe('rtl');
  });

  test('returns ltr when both the computed direction and the ancestor attribute say ltr', () => {
    const reader: WritingDirectionReader = {
      getComputedDirection: () => 'ltr',
      closestDirAttribute: () => 'ltr',
    };
    const element = document.createElement('div');

    expect(resolveWritingDirection(element, reader)).toBe('ltr');
  });

  test('returns ltr when the computed direction is ltr and no [dir] ancestor exists', () => {
    const reader: WritingDirectionReader = {
      getComputedDirection: () => 'ltr',
      closestDirAttribute: () => null,
    };
    const element = document.createElement('div');

    expect(resolveWritingDirection(element, reader)).toBe('ltr');
  });

  test('does not read the closest [dir] ancestor at all once the computed direction is rtl', () => {
    let closestDirAttributeCalls = 0;
    const reader: WritingDirectionReader = {
      getComputedDirection: () => 'rtl',
      closestDirAttribute: () => {
        closestDirAttributeCalls += 1;
        return null;
      },
    };
    const element = document.createElement('div');

    expect(resolveWritingDirection(element, reader)).toBe('rtl');
    expect(closestDirAttributeCalls).toBe(0);
  });

  test('returns ltr and never calls the reader for a null element', () => {
    let readerCalls = 0;
    const reader: WritingDirectionReader = {
      getComputedDirection: () => {
        readerCalls += 1;
        return 'rtl';
      },
      closestDirAttribute: () => {
        readerCalls += 1;
        return 'rtl';
      },
    };

    expect(resolveWritingDirection(null, reader)).toBe('ltr');
    expect(resolveWritingDirection(undefined, reader)).toBe('ltr');
    expect(readerCalls).toBe(0);
  });

  test('compares the ancestor attribute case-insensitively when it is consulted', () => {
    // HTML's `dir` attribute is case-insensitive, and the attribute is only
    // consulted when computed style answers nothing at all.
    const reader = {
      getComputedDirection: () => '',
      closestDirAttribute: () => 'RTL',
    };

    expect(resolveWritingDirection(document.createElement('div'), reader)).toBe('rtl');
  });

  test('composes with the real domWritingDirectionReader, whose answer is authoritative', () => {
    // The real reader wired to the real resolver. Note what this asserts and why:
    // happy-dom's getComputedStyle reports 'ltr' for EVERY element, including one
    // inside a dir="rtl" ancestor, so the correct result here is 'ltr' — computed
    // style answered, and it wins.
    //
    // That is not the harness being worked around; it is the contract. A browser
    // would report 'rtl' for this same markup and the function would return 'rtl'.
    // Because happy-dom cannot represent writing direction at all, RTL detection
    // through the real reader is verified in the Playwright suite against the
    // horizontal-rtl example, and the priority rule itself is verified above by
    // injecting a reader.
    const ancestor = document.createElement('div');
    ancestor.setAttribute('dir', 'rtl');
    const element = document.createElement('div');
    ancestor.append(element);
    document.body.append(ancestor);

    expect(resolveWritingDirection(element, domWritingDirectionReader)).toBe('ltr');
  });
});

describe('domWritingDirectionReader', () => {
  test('getComputedDirection reads the real computed style, reflecting an inline direction override', () => {
    const rtlElement = document.createElement('div');
    rtlElement.style.direction = 'rtl';
    document.body.append(rtlElement);
    expect(domWritingDirectionReader.getComputedDirection(rtlElement)).toBe('rtl');

    const ltrElement = document.createElement('div');
    document.body.append(ltrElement);
    expect(domWritingDirectionReader.getComputedDirection(ltrElement)).toBe('ltr');
  });

  test("closestDirAttribute returns the nearest ancestor's dir attribute, including the element itself", () => {
    const ancestor = document.createElement('div');
    ancestor.setAttribute('dir', 'rtl');
    const child = document.createElement('span');
    ancestor.append(child);
    document.body.append(ancestor);

    expect(domWritingDirectionReader.closestDirAttribute(child)).toBe('rtl');
    expect(domWritingDirectionReader.closestDirAttribute(ancestor)).toBe('rtl');
  });

  test('closestDirAttribute returns null when no ancestor carries a dir attribute', () => {
    const element = document.createElement('div');
    document.body.append(element);

    expect(domWritingDirectionReader.closestDirAttribute(element)).toBeNull();
  });
});

describe('normalizeInlineScrollOffset', () => {
  test('passes the raw value through unchanged under ltr, regardless of rtlScrollType', () => {
    expect(normalizeInlineScrollOffset(77, 500, 200, 'ltr', 'default')).toBe(77);
    expect(normalizeInlineScrollOffset(77, 500, 200, 'ltr', 'negative')).toBe(77);
    expect(normalizeInlineScrollOffset(77, 500, 200, 'ltr', 'reverse')).toBe(77);
  });

  describe('rtl "default" convention (0 at start, grows positive toward the end)', () => {
    test('at the start edge', () => {
      expect(normalizeInlineScrollOffset(0, 400, 100, 'rtl', 'default')).toBe(0);
    });

    test('at the end edge', () => {
      expect(normalizeInlineScrollOffset(300, 400, 100, 'rtl', 'default')).toBe(300);
    });

    test('at a midpoint', () => {
      expect(normalizeInlineScrollOffset(150, 400, 100, 'rtl', 'default')).toBe(150);
    });
  });

  describe('rtl "negative" convention (0 at start, grows negative toward the end)', () => {
    test('at the start edge', () => {
      expect(normalizeInlineScrollOffset(0, 400, 100, 'rtl', 'negative')).toBe(0);
    });

    test('at the end edge', () => {
      expect(normalizeInlineScrollOffset(-300, 400, 100, 'rtl', 'negative')).toBe(300);
    });

    test('at a midpoint', () => {
      expect(normalizeInlineScrollOffset(-150, 400, 100, 'rtl', 'negative')).toBe(150);
    });
  });

  describe('rtl "reverse" convention (max at start, decreases to 0 at the end)', () => {
    test('at the start edge', () => {
      expect(normalizeInlineScrollOffset(300, 400, 100, 'rtl', 'reverse')).toBe(0);
    });

    test('at the end edge', () => {
      expect(normalizeInlineScrollOffset(0, 400, 100, 'rtl', 'reverse')).toBe(300);
    });

    test('at a midpoint', () => {
      expect(normalizeInlineScrollOffset(150, 400, 100, 'rtl', 'reverse')).toBe(150);
    });
  });

  test('handles a degenerate case with no scrollable overflow (scrollWidth === clientWidth)', () => {
    // maxScrollOffset collapses to 0 for every convention; "reverse" is the
    // one that actually computes from scrollWidth/clientWidth, so it is the
    // meaningful case to pin here.
    expect(normalizeInlineScrollOffset(0, 200, 200, 'rtl', 'reverse')).toBe(0);
    expect(normalizeInlineScrollOffset(0, 200, 200, 'rtl', 'default')).toBe(0);
    expect(normalizeInlineScrollOffset(0, 200, 200, 'rtl', 'negative')).toBe(0);
  });
});

describe('resolveRowLayoutDescriptor', () => {
  test('vertical axis uses block-size and inset-block-start', () => {
    expect(resolveRowLayoutDescriptor('vertical')).toEqual({
      sizeProperty: 'block-size',
      offsetProperty: 'inset-block-start',
    });
  });

  test('horizontal axis uses inline-size and inset-inline-start', () => {
    expect(resolveRowLayoutDescriptor('horizontal')).toEqual({
      sizeProperty: 'inline-size',
      offsetProperty: 'inset-inline-start',
    });
  });
});

describe('resolveAbsoluteRowStyle', () => {
  test('vertical axis emits inset-block-start and block-size', () => {
    expect(resolveAbsoluteRowStyle('vertical', 120, 48)).toBe(
      'inset-block-start:120px;block-size:48px;',
    );
  });

  test('horizontal axis emits inset-inline-start and inline-size', () => {
    expect(resolveAbsoluteRowStyle('horizontal', 30, 96)).toBe(
      'inset-inline-start:30px;inline-size:96px;',
    );
  });

  test('a zero size is rendered as-is', () => {
    expect(resolveAbsoluteRowStyle('vertical', 0, 0)).toBe('inset-block-start:0px;block-size:0px;');
  });

  test('a negative size is rendered as-is, with no clamping', () => {
    // Callers (Wave 4's sticky-layout span math) are responsible for ever
    // producing a negative size in the first place; this function's job is
    // only to format whatever it is given.
    expect(resolveAbsoluteRowStyle('horizontal', -10, -5)).toBe(
      'inset-inline-start:-10px;inline-size:-5px;',
    );
  });
});

describe('classifyRtlScrollType', () => {
  test('identifies the reverse convention from a positive start offset', () => {
    // Pre-85 Chrome and old WebKit: scrollLeft starts at scrollWidth - clientWidth.
    expect(classifyRtlScrollType(300, 300)).toBe('reverse');
  });

  test('identifies the negative convention, which is what current browsers do', () => {
    // Firefox, Safari, and Chrome 85 onward: starts at 0, accepts a negative write.
    expect(classifyRtlScrollType(0, -1)).toBe('negative');
  });

  test('identifies the legacy default convention, which clamps a negative write to 0', () => {
    // Legacy Edge/IE: starts at 0 like 'negative' but refuses to go below it.
    expect(classifyRtlScrollType(0, 0)).toBe('default');
  });
});

describe('normalizeInlineScrollOffset — raw/normalized mapping', () => {
  // The component's write path normalizes a second time to convert a start-edge
  // offset back into a raw scrollLeft, which is only sound because this function is
  // its own inverse. But the involution alone is too weak to pin the behaviour:
  // `Math.abs` also satisfies f(f(x)) === x for non-negative input, while sending
  // every programmatic RTL scroll to the clamped 0 edge. So assert the concrete
  // mapping in BOTH directions, sign included.
  const scrollWidth = 6_400;
  const clientWidth = 480;
  const maxOffset = scrollWidth - clientWidth;

  function normalize(value: number, rtlScrollType: 'negative' | 'reverse' | 'default') {
    return normalizeInlineScrollOffset(value, scrollWidth, clientWidth, 'rtl', rtlScrollType);
  }

  test('negative convention: raw runs 0 down to -max as you scroll away from the start', () => {
    // What every current browser does. Reads come in negative and must normalize
    // positive; writes go out negative.
    expect(normalize(-1_600, 'negative')).toBe(1_600);
    expect(normalize(1_600, 'negative')).toBe(-1_600);
    expect(normalize(-maxOffset, 'negative')).toBe(maxOffset);
    expect(normalize(maxOffset, 'negative')).toBe(-maxOffset);
  });

  test('reverse convention: raw starts at max and decreases', () => {
    expect(normalize(maxOffset, 'reverse')).toBe(0);
    expect(normalize(maxOffset - 1_600, 'reverse')).toBe(1_600);
    expect(normalize(1_600, 'reverse')).toBe(maxOffset - 1_600);
    expect(normalize(0, 'reverse')).toBe(maxOffset);
  });

  test('default convention: raw starts at 0 and grows positive, so it is the identity', () => {
    expect(normalize(0, 'default')).toBe(0);
    expect(normalize(1_600, 'default')).toBe(1_600);
    expect(normalize(maxOffset, 'default')).toBe(maxOffset);
  });

  for (const rtlScrollType of ['negative', 'reverse', 'default'] as const) {
    test(`is its own inverse under the ${rtlScrollType} convention`, () => {
      for (const offset of [0, 1, 160, 3_200, maxOffset]) {
        expect(normalize(normalize(offset, rtlScrollType), rtlScrollType)).toBe(offset);
      }
    });
  }

  test('maps the start edge to positive zero, not negative zero', () => {
    // A bare unary minus produces -0 here. It compares equal with `===` but not with
    // Object.is, and the offsets comparisons downstream are Object.is-based.
    expect(Object.is(normalize(0, 'negative'), 0)).toBe(true);
  });

  test('is the identity in ltr regardless of the detected convention', () => {
    for (const rtlScrollType of ['negative', 'reverse', 'default'] as const) {
      expect(
        normalizeInlineScrollOffset(1_600, scrollWidth, clientWidth, 'ltr', rtlScrollType),
      ).toBe(1_600);
    }
  });
});

describe('resolveObservedMainAxisSize', () => {
  const contentRect = { width: 160, height: 48 };

  test('takes the block size for a vertical list', () => {
    const size = resolveObservedMainAxisSize(
      { blockSize: 48, inlineSize: 160 },
      contentRect,
      'vertical',
    );
    expect(size).toBe(48);
  });

  test('takes the inline size for a horizontal list', () => {
    // The bug this replaces measured every column by its HEIGHT, which produced an
    // offsets table describing a list that does not exist.
    const size = resolveObservedMainAxisSize(
      { blockSize: 48, inlineSize: 160 },
      contentRect,
      'horizontal',
    );
    expect(size).toBe(160);
  });

  test('falls back to the physical contentRect axis when borderBoxSize is absent', () => {
    expect(resolveObservedMainAxisSize(undefined, contentRect, 'vertical')).toBe(48);
    expect(resolveObservedMainAxisSize(undefined, contentRect, 'horizontal')).toBe(160);
  });

  test('prefers borderBoxSize over contentRect, which excludes padding and border', () => {
    const padded = { width: 100, height: 20 };
    expect(
      resolveObservedMainAxisSize({ blockSize: 48, inlineSize: 160 }, padded, 'vertical'),
    ).toBe(48);
    expect(
      resolveObservedMainAxisSize({ blockSize: 48, inlineSize: 160 }, padded, 'horizontal'),
    ).toBe(160);
  });

  test('keeps a genuine zero rather than falling through to the rect', () => {
    // A collapsed row measures zero. `??` is load-bearing here: `||` would discard
    // it and substitute the rect, reserving space the row no longer occupies.
    expect(
      resolveObservedMainAxisSize({ blockSize: 0, inlineSize: 0 }, contentRect, 'vertical'),
    ).toBe(0);
    expect(
      resolveObservedMainAxisSize({ blockSize: 0, inlineSize: 0 }, contentRect, 'horizontal'),
    ).toBe(0);
  });
});
