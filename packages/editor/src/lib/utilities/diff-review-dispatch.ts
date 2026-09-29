/**
 * Shared controlled-state dispatch for the DiffReview leaves (COR-509 / DR-6).
 *
 * `reduceDiffReviewState` is a pure transition function: the host must
 * synchronously accept its result before dispatching another action. Both
 * `DiffReview` and `DiffReviewComments` share exactly this wrapper so every
 * mutation goes through the same accept-or-reject path rather than each
 * component re-deriving it.
 *
 * @module
 */

import type {
  DiffReviewAction,
  DiffReviewActionOptions,
  DiffReviewResult,
  DiffReviewState,
} from '../diff-review-state/index.ts';
import { reduceDiffReviewState } from '../diff-review-state/index.ts';

/**
 * Dispatch `action` against `state`. On success, calls `onstatechange` with
 * the next state before returning it. On failure, `onstatechange` is never
 * called and the previous state remains in effect.
 */
export function dispatchDiffReviewAction(
  state: DiffReviewState,
  action: DiffReviewAction,
  onstatechange: (next: DiffReviewState) => void,
  options?: DiffReviewActionOptions,
): DiffReviewResult<DiffReviewState> {
  const result = reduceDiffReviewState(state, action, options);
  if (result.ok) onstatechange(result.value);
  return result;
}
