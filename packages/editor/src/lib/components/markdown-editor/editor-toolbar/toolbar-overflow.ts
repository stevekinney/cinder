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
   * Full measured width, in pixels, this group occupies when rendered
   * inline — including its own leading separator and the toolbar's flex
   * gap on both sides of that separator.
   */
  width: number;
}

export interface ComputeToolbarOverflowInput {
  /**
   * Width available to the flexible group region: the toolbar's own
   * content-box width minus the always-visible leading cluster (History +
   * Block type) and any trailing actions/spacer. `0` or a negative value
   * means "not yet measured" (SSR, pre-mount, or a `ResizeObserver` entry
   * that hasn't landed yet), not "zero room."
   */
  availableWidth: number;
  /**
   * Width the "More formatting" trigger reserves (plus its own leading
   * separator/gap) — only charged against the budget when at least one
   * group doesn't fit. A trigger that isn't needed shouldn't shrink the
   * budget for the groups that do fit.
   */
  overflowTriggerWidth: number;
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
 * in `availableWidth`. The first group that doesn't fit — and every group
 * after it — moves to the overflow set. Groups are never reordered: a
 * smaller, lower-priority group never jumps ahead of a larger one that
 * didn't fit, which would otherwise leave a visually confusing gap.
 */
export function computeToolbarOverflow({
  availableWidth,
  overflowTriggerWidth,
  groups,
}: ComputeToolbarOverflowInput): ComputeToolbarOverflowResult {
  if (availableWidth <= 0) {
    return { visibleGroupIds: groups.map((group) => group.id), overflowGroupIds: [] };
  }

  const totalWidth = groups.reduce((sum, group) => sum + group.width, 0);
  if (totalWidth <= availableWidth) {
    return { visibleGroupIds: groups.map((group) => group.id), overflowGroupIds: [] };
  }

  const budget = availableWidth - overflowTriggerWidth;
  const visibleGroupIds: string[] = [];
  const overflowGroupIds: string[] = [];
  let used = 0;
  let overflowing = false;

  for (const group of groups) {
    if (!overflowing && used + group.width <= budget) {
      used += group.width;
      visibleGroupIds.push(group.id);
    } else {
      overflowing = true;
      overflowGroupIds.push(group.id);
    }
  }

  return { visibleGroupIds, overflowGroupIds };
}
