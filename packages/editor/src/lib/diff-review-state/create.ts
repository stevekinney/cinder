/**
 * `createDiffReviewState` — the public entry point for a fresh diff-review session.
 *
 * @module
 */

import { computeDiffReviewSnapshotId } from './identity.js';
import type { DiffReviewResult, DiffReviewState, DiffReviewTargetInput } from './types.js';
import { DIFF_REVIEW_STATE_VERSION } from './types.js';
import { validateDiffReviewTargetList } from './validate-targets.js';

/**
 * Builds the initial state for an ordered list of targets. Validates the list atomically (see
 * `validateDiffReviewTargetList`) and computes each target's content identity. The first target,
 * if any, is selected by default; an empty list has no selection.
 */
export function createDiffReviewState(
  targets: DiffReviewTargetInput[],
): DiffReviewResult<DiffReviewState> {
  const validated = validateDiffReviewTargetList(targets);
  if (!validated.ok) return validated;

  const records = validated.value.map((target) => ({
    targetId: target.targetId,
    kind: target.kind,
    label: target.label,
    repositoryLabel: target.repositoryLabel,
    baseRevisionLabel: target.baseRevisionLabel,
    headRevisionLabel: target.headRevisionLabel,
    snapshotId: computeDiffReviewSnapshotId(target),
  }));

  return {
    ok: true,
    value: {
      version: DIFF_REVIEW_STATE_VERSION,
      targets: records,
      comments: [],
      drafts: [],
      reviewNote: '',
      selectedTargetId: records[0]?.targetId ?? null,
      selectedFileOccurrence: null,
      reviewedMarkers: [],
    },
  };
}
