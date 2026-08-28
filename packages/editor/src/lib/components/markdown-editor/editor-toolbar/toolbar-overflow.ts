/**
 * Priority-plus fit calculation for {@link EditorToolbar}.
 *
 * Pure and framework-free on purpose: happy-dom (this package's test
 * environment) always reports zero-size layout rects, so the width-measured
 * behaviour this powers cannot be proven by rendering the component and
 * inspecting the DOM. This function is the part that carries the actual
 * logic; `editor-toolbar.svelte` only wires real measurements into it.
 */

export interface ToolbarOverflowGroup {
  /** Stable identifier for the group. */
  id: string;
  /**
   * This group's own rendered width, in pixels -- the group's content only,
   * NOT including the toolbar's flex `gap` before it. The gap is charged
   * separately (once per included group) so it can't be double-counted or
   * forgotten by a caller that measures a group in isolation.
   */
  width: number;
}

export interface ComputeToolbarOverflowInput {
  /**
   * Width available to the flexible group region: the toolbar's own
   * content-box width minus the always-visible leading cluster and any
   * reserved trailing actions/spacer.
   *
   * `null` means "not yet measured" -- SSR, pre-mount, or before the first
   * `ResizeObserver` entry has landed. CSS's `flex-wrap: nowrap;
   * overflow-x: auto` fallback covers that window, so every group stays
   * inline.
   *
   * A `number` -- including zero or negative -- is a real measurement: the
   * toolbar has been measured and genuinely has that much (or that little)
   * room. This is deliberately NOT the same case as `null`: a toolbar that
   * really is too narrow for even the leading cluster must still compute
   * "everything overflows," not "keep everything inline because width
   * looked falsy."
   */
  availableWidth: number | null;
  /**
   * The toolbar's flex `gap`, in pixels. Charged once for every group that
   * ends up inline (the boundary before it, whether that boundary is
   * against the leading cluster or against the previous group -- both are
   * one flex gap) and once more if the overflow trigger is needed.
   */
  gap: number;
  /**
   * The "More formatting" trigger's own rendered width, in pixels -- NOT
   * including its leading gap (see `gap`). Only charged against the budget
   * when at least one group doesn't fit; a trigger that isn't shown
   * shouldn't shrink the budget for groups that do fit.
   */
  triggerWidth: number;
  /** Candidate groups in priority order; earlier groups are preferred to stay inline. */
  groups: ToolbarOverflowGroup[];
}

export interface ComputeToolbarOverflowResult {
  /** Group ids that fit inline, in their original priority order. */
  visibleGroupIds: string[];
  /** Group ids that overflow into the "More formatting" popover, in their original priority order. */
  overflowGroupIds: string[];
}

/**
 * Greedily keeps groups inline, in priority order, until they stop fitting
 * in `availableWidth`. The first group that doesn't fit -- and every group
 * after it -- moves to the overflow set. Groups are never reordered: a
 * smaller, lower-priority group never jumps ahead of a larger one that
 * didn't fit, which would otherwise leave a visually confusing gap.
 */
export function computeToolbarOverflow({
  availableWidth,
  gap,
  triggerWidth,
  groups,
}: ComputeToolbarOverflowInput): ComputeToolbarOverflowResult {
  if (availableWidth === null) {
    return { visibleGroupIds: groups.map((group) => group.id), overflowGroupIds: [] };
  }

  const totalWidthAllInline = groups.reduce((sum, group) => sum + gap + group.width, 0);
  if (totalWidthAllInline <= availableWidth) {
    return { visibleGroupIds: groups.map((group) => group.id), overflowGroupIds: [] };
  }

  const budget = availableWidth - (gap + triggerWidth);
  const visibleGroupIds: string[] = [];
  const overflowGroupIds: string[] = [];
  let used = 0;
  let overflowing = false;

  for (const group of groups) {
    const cost = gap + group.width;
    if (!overflowing && used + cost <= budget) {
      used += cost;
      visibleGroupIds.push(group.id);
    } else {
      overflowing = true;
      overflowGroupIds.push(group.id);
    }
  }

  return { visibleGroupIds, overflowGroupIds };
}
