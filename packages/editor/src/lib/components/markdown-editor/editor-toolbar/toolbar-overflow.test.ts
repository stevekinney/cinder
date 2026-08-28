import { describe, expect, it } from 'bun:test';

import { computeToolbarOverflow, type ToolbarOverflowGroup } from './toolbar-overflow.ts';

const groups: ToolbarOverflowGroup[] = [
  { id: 'text-formatting', width: 100 },
  { id: 'links', width: 40 },
  { id: 'lists', width: 60 },
  { id: 'block-operations', width: 30 },
];

describe('computeToolbarOverflow', () => {
  it('keeps every group inline when everything fits (gap included), without reserving trigger width', () => {
    // Raw group widths sum to 230, plus 4 * 10 = 40 of gap (one gap per
    // group) = 270. Reserving the trigger's 50px on top would make an
    // exact-fit budget miss even though the trigger is never shown.
    const result = computeToolbarOverflow({
      availableWidth: 270,
      gap: 10,
      triggerWidth: 50,
      groups,
    });

    expect(result).toEqual({
      visibleGroupIds: ['text-formatting', 'links', 'lists', 'block-operations'],
      overflowGroupIds: [],
    });
  });

  it('treats availableWidth === null as "not yet measured" and keeps everything inline', () => {
    expect(
      computeToolbarOverflow({ availableWidth: null, gap: 10, triggerWidth: 50, groups }),
    ).toEqual({
      visibleGroupIds: groups.map((group) => group.id),
      overflowGroupIds: [],
    });
  });

  it('treats a real non-positive measurement as "no room," not as unmeasured', () => {
    // availableWidth === 0 is a genuine measurement (the toolbar really has
    // no room), unlike availableWidth === null. Every group must overflow,
    // the opposite of the null case above.
    const zero = computeToolbarOverflow({ availableWidth: 0, gap: 10, triggerWidth: 50, groups });
    expect(zero).toEqual({
      visibleGroupIds: [],
      overflowGroupIds: ['text-formatting', 'links', 'lists', 'block-operations'],
    });

    const negative = computeToolbarOverflow({
      availableWidth: -10,
      gap: 10,
      triggerWidth: 50,
      groups,
    });
    expect(negative).toEqual({
      visibleGroupIds: [],
      overflowGroupIds: ['text-formatting', 'links', 'lists', 'block-operations'],
    });
  });

  it('charges one flex gap per inline group so raw widths alone cannot pass as "fits"', () => {
    // Raw widths sum to 90 (30+30+30), which would fit in 95 with no gap
    // accounting at all -- exactly the bug under test. With a 10px gap
    // charged per group (30 inline gaps: 3 * 10 = 30), the real inline
    // footprint is 120, which does not fit in 95.
    const threeGroups: ToolbarOverflowGroup[] = [
      { id: 'a', width: 30 },
      { id: 'b', width: 30 },
      { id: 'c', width: 30 },
    ];

    const result = computeToolbarOverflow({
      availableWidth: 95,
      gap: 10,
      triggerWidth: 20,
      groups: threeGroups,
    });

    // budget = 95 - (10 + 20) = 65. First group costs 10 + 30 = 40 (fits,
    // used = 40). Second group costs another 40 (40 + 40 = 80 > 65) -- it
    // and everything after it overflow.
    expect(result).toEqual({
      visibleGroupIds: ['a'],
      overflowGroupIds: ['b', 'c'],
    });
  });

  it('reserves trigger width (plus its own gap) and greedily fits groups in priority order', () => {
    // availableWidth 200, gap 10, trigger 20 -> reserved = 30, budget 170.
    // text-formatting costs 10+100=110 (fits, used 110). links costs
    // 10+40=50 (110+50=160 <= 170, fits, used 160). lists costs 10+60=70
    // (160+70=230 > 170) -- lists and block-operations overflow.
    const result = computeToolbarOverflow({
      availableWidth: 200,
      gap: 10,
      triggerWidth: 20,
      groups,
    });

    expect(result).toEqual({
      visibleGroupIds: ['text-formatting', 'links'],
      overflowGroupIds: ['lists', 'block-operations'],
    });
  });

  it('never lets a smaller lower-priority group jump ahead of a larger one that overflowed', () => {
    // links (10+40=50) and block-operations (10+30=40) would each
    // individually fit in the leftover budget after text-formatting
    // overflows, but priority order is preserved -- everything after the
    // first miss overflows too, rather than backfilling gaps.
    const result = computeToolbarOverflow({
      availableWidth: 100,
      gap: 10,
      triggerWidth: 20,
      groups,
    });

    expect(result).toEqual({
      visibleGroupIds: [],
      overflowGroupIds: ['text-formatting', 'links', 'lists', 'block-operations'],
    });
  });

  it('puts every group inline when there are no candidate groups', () => {
    const result = computeToolbarOverflow({
      availableWidth: 10,
      gap: 10,
      triggerWidth: 20,
      groups: [],
    });

    expect(result).toEqual({ visibleGroupIds: [], overflowGroupIds: [] });
  });

  it('fits exactly at the boundary (gap included) without overflowing', () => {
    const result = computeToolbarOverflow({
      availableWidth: 140,
      gap: 10,
      triggerWidth: 20,
      groups: [{ id: 'only', width: 130 }],
    });

    expect(result).toEqual({ visibleGroupIds: ['only'], overflowGroupIds: [] });
  });
});
