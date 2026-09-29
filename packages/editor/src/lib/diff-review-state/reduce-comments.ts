/**
 * Comment, review-note, and reviewed-marker action handlers for `reduceDiffReviewState`.
 *
 * @module
 */

import { buildDiffReviewCapturedContext } from './captured-context.js';
import { nextDiffReviewUpdatedAt } from './clock.js';
import type {
  DiffReviewAction,
  DiffReviewComment,
  DiffReviewError,
  DiffReviewResult,
  DiffReviewState,
} from './types.js';
import { validateDiffReviewAnchor } from './validate-anchor.js';

function nonemptyBodyError(path: string): DiffReviewError {
  return {
    code: 'invalid-record',
    path,
    message: 'A comment body cannot be empty or whitespace-only.',
  };
}

function notFound(domain: string, path: string): DiffReviewError {
  return { code: 'invalid-record', path, message: `No such ${domain}.` };
}

export function applyCreateComment(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'create-comment' }>,
  clock: () => string,
  idFactory: () => string,
): DiffReviewResult<DiffReviewState> {
  if (action.body.trim().length === 0) {
    return { ok: false, error: nonemptyBodyError('/body') };
  }

  const target = state.targets.find((t) => t.targetId === action.targetId);
  if (!target) {
    return {
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: 'No such live target.' },
    };
  }

  const anchorResult = validateDiffReviewAnchor(action.anchor, '/anchor');
  if (!anchorResult.ok) return anchorResult;

  const id = action.id ?? idFactory();
  if (state.comments.some((comment) => comment.id === id)) {
    return {
      ok: false,
      error: { code: 'duplicate-id', path: '/id', message: `Duplicate comment id '${id}'.` },
    };
  }

  const now = clock();
  const comment: DiffReviewComment = {
    id,
    targetId: action.targetId,
    snapshotId: target.snapshotId,
    anchor: anchorResult.value,
    capturedContext: buildDiffReviewCapturedContext(target, anchorResult.value, {
      oldPath: action.oldPath,
      newPath: action.newPath,
    }),
    body: action.body,
    createdAt: now,
    updatedAt: now,
    resolved: false,
    outdated: false,
  };

  return { ok: true, value: { ...state, comments: [...state.comments, comment] } };
}

export function applyEditComment(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'edit-comment' }>,
  clock: () => string,
): DiffReviewResult<DiffReviewState> {
  if (action.body.trim().length === 0) {
    return { ok: false, error: nonemptyBodyError('/body') };
  }
  const index = state.comments.findIndex((comment) => comment.id === action.id);
  if (index === -1) return { ok: false, error: notFound('comment', '/id') };

  const comment = state.comments[index]!;
  const updated: DiffReviewComment = {
    ...comment,
    body: action.body,
    updatedAt: nextDiffReviewUpdatedAt(comment.updatedAt, clock()),
  };
  const comments = [...state.comments];
  comments[index] = updated;
  return { ok: true, value: { ...state, comments } };
}

export function applyDeleteComment(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'delete-comment' }>,
): DiffReviewResult<DiffReviewState> {
  if (!state.comments.some((comment) => comment.id === action.id)) {
    return { ok: false, error: notFound('comment', '/id') };
  }
  return {
    ok: true,
    value: { ...state, comments: state.comments.filter((comment) => comment.id !== action.id) },
  };
}

function setResolved(
  state: DiffReviewState,
  id: string,
  resolved: boolean,
  clock: () => string,
): DiffReviewResult<DiffReviewState> {
  const index = state.comments.findIndex((comment) => comment.id === id);
  if (index === -1) return { ok: false, error: notFound('comment', '/id') };

  const comment = state.comments[index]!;
  const updated: DiffReviewComment = {
    ...comment,
    resolved,
    updatedAt: nextDiffReviewUpdatedAt(comment.updatedAt, clock()),
  };
  const comments = [...state.comments];
  comments[index] = updated;
  return { ok: true, value: { ...state, comments } };
}

export function applyResolveComment(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'resolve-comment' }>,
  clock: () => string,
): DiffReviewResult<DiffReviewState> {
  return setResolved(state, action.id, true, clock);
}

export function applyReopenComment(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'reopen-comment' }>,
  clock: () => string,
): DiffReviewResult<DiffReviewState> {
  return setResolved(state, action.id, false, clock);
}

export function applySetReviewNote(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'set-review-note' }>,
): DiffReviewResult<DiffReviewState> {
  return { ok: true, value: { ...state, reviewNote: action.body } };
}

export function applySetReviewed(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'set-reviewed' }>,
): DiffReviewResult<DiffReviewState> {
  const target = state.targets.find((t) => t.targetId === action.targetId);
  if (!target) {
    return {
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: 'No such live target.' },
    };
  }

  const withoutExisting = state.reviewedMarkers.filter(
    (marker) =>
      !(marker.targetId === action.targetId && marker.fileOccurrence === action.fileOccurrence),
  );

  if (!action.reviewed) {
    return { ok: true, value: { ...state, reviewedMarkers: withoutExisting } };
  }

  return {
    ok: true,
    value: {
      ...state,
      reviewedMarkers: [
        ...withoutExisting,
        {
          targetId: action.targetId,
          snapshotId: target.snapshotId,
          fileOccurrence: action.fileOccurrence,
        },
      ],
    },
  };
}
