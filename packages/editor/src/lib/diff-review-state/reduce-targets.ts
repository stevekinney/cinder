/**
 * `set-targets`, `select-target`, and `select-file` action handlers for `reduceDiffReviewState`
 * (DR-2 normative handoff, "Identity, schema, and validation" and "Drafts, modes, and
 * ReviewEditor" restore-matching rules, which this shares with the live update path).
 *
 * @module
 */

import { computeDiffReviewSnapshotId } from './identity.js';
import type {
  DiffReviewAction,
  DiffReviewResult,
  DiffReviewState,
  DiffReviewTargetRecord,
} from './types.js';
import { validateDiffReviewTargetList } from './validate-targets.js';

/**
 * Applies a validated new target list against the previous state: latches every comment and
 * draft whose target changed content or disappeared as outdated (never un-latching an
 * already-outdated record), drops reviewed markers for those same targets, and reconciles the
 * current selection. Comments and drafts for a removed target are otherwise retained untouched,
 * by captured context, per the contract.
 */
export function applySetTargets(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'set-targets' }>,
): DiffReviewResult<DiffReviewState> {
  const validated = validateDiffReviewTargetList(action.targets);
  if (!validated.ok) return validated;

  const previousSnapshotById = new Map(state.targets.map((t) => [t.targetId, t.snapshotId]));

  const nextTargets: DiffReviewTargetRecord[] = validated.value.map((target) => ({
    targetId: target.targetId,
    kind: target.kind,
    label: target.label,
    repositoryLabel: target.repositoryLabel,
    baseRevisionLabel: target.baseRevisionLabel,
    headRevisionLabel: target.headRevisionLabel,
    snapshotId: computeDiffReviewSnapshotId(target),
  }));
  const nextSnapshotById = new Map(nextTargets.map((t) => [t.targetId, t.snapshotId]));

  const changedOrRemoved = new Set<string>();
  for (const [targetId, previousSnapshotId] of previousSnapshotById) {
    const nextSnapshotId = nextSnapshotById.get(targetId);
    if (nextSnapshotId === undefined || nextSnapshotId !== previousSnapshotId) {
      changedOrRemoved.add(targetId);
    }
  }

  const comments = state.comments.map((comment) =>
    changedOrRemoved.has(comment.targetId) ? { ...comment, outdated: true } : comment,
  );

  const drafts = state.drafts.map((draft) =>
    changedOrRemoved.has(draft.targetId) ? { ...draft, outdated: true } : draft,
  );

  const reviewedMarkers = state.reviewedMarkers.filter(
    (marker) => !changedOrRemoved.has(marker.targetId),
  );

  const stillSelected =
    state.selectedTargetId !== null && nextSnapshotById.has(state.selectedTargetId);
  const selectedTargetId = stillSelected
    ? state.selectedTargetId
    : (nextTargets[0]?.targetId ?? null);
  const selectedFileOccurrence = stillSelected ? state.selectedFileOccurrence : null;

  return {
    ok: true,
    value: {
      ...state,
      targets: nextTargets,
      comments,
      drafts,
      reviewedMarkers,
      selectedTargetId,
      selectedFileOccurrence,
    },
  };
}

export function applySelectTarget(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'select-target' }>,
): DiffReviewResult<DiffReviewState> {
  if (action.targetId !== null && !state.targets.some((t) => t.targetId === action.targetId)) {
    return {
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: 'No such live target.' },
    };
  }
  return { ok: true, value: { ...state, selectedTargetId: action.targetId } };
}

export function applySelectFile(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'select-file' }>,
): DiffReviewResult<DiffReviewState> {
  return { ok: true, value: { ...state, selectedFileOccurrence: action.fileOccurrence } };
}
