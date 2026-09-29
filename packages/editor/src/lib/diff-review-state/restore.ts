/**
 * `restoreDiffReviewState` — validates a serialized snapshot and the host's freshly supplied
 * target content, then reconciles them (DR-2 normative handoff, "Drafts, modes, and
 * ReviewEditor").
 *
 * Restore matches by target ID, never by path, and shares its invalidation, reviewed-marker
 * reset, and selection-fallback logic with the live `set-targets` action — the contract states
 * this behavior is identical for remount and an atomic live target-list update, so this composes
 * `applySetTargets` directly rather than re-implementing it.
 *
 * @module
 */

import { applySetTargets } from './reduce-targets.js';
import type { DiffReviewResult, DiffReviewState, DiffReviewTargetInput } from './types.js';
import { validateSerializedDiffReviewState } from './validate-serialized.js';
import { validateDiffReviewTargetList } from './validate-targets.js';

export function restoreDiffReviewState(
  serialized: unknown,
  targets: DiffReviewTargetInput[],
): DiffReviewResult<DiffReviewState> {
  const validatedTargets = validateDiffReviewTargetList(targets);
  if (!validatedTargets.ok) return validatedTargets;

  const liveTargetIds = new Set(validatedTargets.value.map((target) => target.targetId));
  const validatedState = validateSerializedDiffReviewState(serialized, liveTargetIds);
  if (!validatedState.ok) return validatedState;

  return applySetTargets(validatedState.value, {
    type: 'set-targets',
    targets: validatedTargets.value,
  });
}
