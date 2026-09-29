/**
 * App-local DOM composition over `RunStepTimeline` for the Checkpoints tab's
 * divergence highlight (plan design §7.3).
 *
 * Step *selection* used to live here too (plan design §E), as a DOM
 * workaround: Cinder v0.16.1's `RunStepTimeline` had no selection API at
 * all — no `selectedStepId`, no click/keyboard handling, no per-step
 * `class`/`style` override. Cinder 0.24.0 added `selectedStepId` and
 * `onStepSelect` props (WFC-7), so `../timeline-tab.svelte` now wires
 * selection straight through those props instead of reaching into Cinder's
 * rendered DOM. That upstream API has no divergence equivalent — Cinder has
 * no concept of "diverged" steps, and single-selection `selectedStepId`
 * can't represent an arbitrary set of rows — so the divergence highlight
 * below still needs this app-local composition.
 *
 * ## Why decoding `data-cinder-path` back to a step id is safe here
 *
 * `run-step-timeline.svelte`'s `pathKey` for every TOP-LEVEL entry (main
 * rail or a branch lane — `flattenSteps(lane.steps, '')` uses the same empty
 * prefix as the main rail) equals the step's own `id`, percent-escaped only
 * if it contains `%` or `/`. `timeline-mapping.ts` mints ids as `step-<n>`
 * or `step-<n>-branch-<m>` (digits and hyphens only), so escaping never
 * triggers and the path is the id verbatim — decoding is the identity
 * function, not a fragile unescape.
 *
 * ## Selector: the public `data-cinder-path` attribute, not the private class
 *
 * Every element Cinder stamps `data-cinder-path` onto is a step/branch row
 * — plain steps, branch-group items, and branch-lane steps alike (verified
 * against `run-step-timeline`'s compiled output). Divergence highlighting
 * only targets top-level steps, so `stepIdFromItem`'s regex deliberately
 * narrows to the top-level `step-<n>` shape and leaves branch-lane ids
 * (`step-<n>-branch-<m>`) unmatched, even though those are also app-minted.
 * The private `.cinder-run-step-timeline__item` class buys nothing extra
 * here either way; querying `[data-cinder-path]` alone is sufficient and
 * keeps this module off Cinder's internal class names entirely.
 */

const RUN_STEP_ITEM_SELECTOR = '[data-cinder-path]';

function stepIdFromItem(item: Element): string | null {
  const path = item.getAttribute('data-cinder-path');
  if (path === null) return null;
  // Only claim paths this app minted (see module doc) — a nested/lane path
  // this module doesn't recognize is left alone rather than guessed at.
  return /^step-\d+$/.test(path) ? path : null;
}

/**
 * Imperatively syncs a marker attribute onto the rendered rows whose step id
 * is in `matchStepIds`. Idempotent — clears any stale marker before
 * re-applying. The low-level primitive behind the Checkpoints tab's
 * divergence highlight (driven by `alignTimelinesForDivergence` — see
 * `checkpoints/divergence.ts`).
 */
function markRunStepTimelineItems(
  container: HTMLElement,
  matchStepIds: ReadonlySet<string>,
  attribute: string,
): void {
  for (const item of container.querySelectorAll(`[${attribute}]`)) {
    item.removeAttribute(attribute);
  }
  for (const item of container.querySelectorAll(RUN_STEP_ITEM_SELECTOR)) {
    const stepId = stepIdFromItem(item);
    if (stepId !== null && matchStepIds.has(stepId)) item.setAttribute(attribute, '');
  }
}

const DIVERGED_ATTRIBUTE = 'data-weft-timeline-diverged';

/** Marks every rendered row whose step id is in `divergedStepIds` — used by the Checkpoints tab's side-by-side divergence view. */
export function applyRunStepTimelineDivergenceHighlight(
  container: HTMLElement,
  divergedStepIds: ReadonlySet<string>,
): void {
  markRunStepTimelineItems(container, divergedStepIds, DIVERGED_ATTRIBUTE);
}
