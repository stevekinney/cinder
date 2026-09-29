/**
 * `serializeDiffReviewState` — produces the versioned, JSON-safe snapshot
 * `restoreDiffReviewState` accepts. Every field in `DiffReviewState` is already normative
 * serialized data (see the DR-2 normative handoff); nothing here is display-derived, so this is
 * a defensive structural copy, not a projection.
 *
 * @module
 */

import type { DiffReviewSerializedState, DiffReviewState } from './types.js';

export function serializeDiffReviewState(state: DiffReviewState): DiffReviewSerializedState {
  return {
    version: state.version,
    targets: state.targets.map((target) => ({ ...target })),
    comments: state.comments.map((comment) => ({
      ...comment,
      anchor: { ...comment.anchor },
      capturedContext: {
        ...comment.capturedContext,
        rawMapping: { ...comment.capturedContext.rawMapping },
      },
    })),
    drafts: state.drafts.map((draft) => ({
      ...draft,
      anchor: { ...draft.anchor },
      capturedContext: {
        ...draft.capturedContext,
        rawMapping: { ...draft.capturedContext.rawMapping },
      },
    })),
    reviewNote: state.reviewNote,
    selectedTargetId: state.selectedTargetId,
    selectedFileOccurrence: state.selectedFileOccurrence,
    reviewedMarkers: state.reviewedMarkers.map((marker) => ({ ...marker })),
  };
}
