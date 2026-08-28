import { describe, expect, it } from 'bun:test';

import { computeToolbarOverflow, type ToolbarOverflowGroup } from './toolbar-overflow.ts';

const groups: ToolbarOverflowGroup[] = [
  { id: 'text-formatting', width: 100 },
  { id: 'links', width: 40 },
  { id: 'lists', width: 60 },
  { id: 'block-operations', width: 30 },
];

describe('computeToolbarOverflow', () => {
  it('keeps every group inline when everything fits, without reserving trigger width', () => {
    // Total group width is 230. Reserving the trigger's 50px would make an
    // exact-fit budget miss even though the trigger is never shown.
    const result = computeToolbarOverflow({
      availableWidth: 230,
      overflowTriggerWidth: 50,
      groups,
    });

    expect(result).toEqual({
      visibleGroupIds: ['text-formatting', 'links', 'lists', 'block-operations'],
      overflowGroupIds: [],
    });
  });

  it('treats a non-positive availableWidth as "not yet measured" and keeps everything inline', () => {
    expect(computeToolbarOverflow({ availableWidth: 0, overflowTriggerWidth: 50, groups })).toEqual(
      {
        visibleGroupIds: groups.map((group) => group.id),
        overflowGroupIds: [],
      },
    );

    expect(
      computeToolbarOverflow({ availableWidth: -10, overflowTriggerWidth: 50, groups }),
    ).toEqual({
      visibleGroupIds: groups.map((group) => group.id),
      overflowGroupIds: [],
    });
  });

  it('reserves trigger width and greedily fits groups in priority order', () => {
    // availableWidth 150, trigger 20 -> budget 130.
    // text-formatting (100) fits (used 100), links (40) does not (140 > 130)
    // -> links, lists, and block-operations all overflow.
    const result = computeToolbarOverflow({
      availableWidth: 150,
      overflowTriggerWidth: 20,
      groups,
    });

    expect(result).toEqual({
      visibleGroupIds: ['text-formatting'],
      overflowGroupIds: ['links', 'lists', 'block-operations'],
    });
  });

  it('never lets a smaller lower-priority group jump ahead of a larger one that overflowed', () => {
    // links (40) and block-operations (30) would each individually fit in
    // the leftover budget after text-formatting, but once text-formatting
    // overflows, priority order is preserved — everything after it overflows
    // too, rather than backfilling gaps.
    const result = computeToolbarOverflow({
      availableWidth: 90,
      overflowTriggerWidth: 20,
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
      overflowTriggerWidth: 20,
      groups: [],
    });

    expect(result).toEqual({ visibleGroupIds: [], overflowGroupIds: [] });
  });

  it('fits exactly at the boundary without overflowing', () => {
    const result = computeToolbarOverflow({
      availableWidth: 130,
      overflowTriggerWidth: 20,
      groups: [{ id: 'only', width: 130 }],
    });

    expect(result).toEqual({ visibleGroupIds: ['only'], overflowGroupIds: [] });
  });
});
