/**
 * `reduceDiffReviewState` — the single public transition function for the diff-review state
 * model. Returns the next immutable state or a structured error; the host synchronously accepts
 * the result before dispatching another action. Never mutates the state it is given.
 *
 * @module
 */

import { defaultDiffReviewClock, defaultDiffReviewIdFactory } from './clock.js';
import {
  applyCreateComment,
  applyDeleteComment,
  applyEditComment,
  applyReopenComment,
  applyResolveComment,
  applySetReviewNote,
  applySetReviewed,
} from './reduce-comments.js';
import {
  applyCreateDraft,
  applyDiscardDraft,
  applySaveDraft,
  applyUpdateDraft,
} from './reduce-drafts.js';
import { applySelectFile, applySelectTarget, applySetTargets } from './reduce-targets.js';
import {
  DIFF_REVIEW_MUTATING_ACTION_TYPES,
  type DiffReviewAction,
  type DiffReviewActionOptions,
  type DiffReviewResult,
  type DiffReviewState,
} from './types.js';

export function reduceDiffReviewState(
  state: DiffReviewState,
  action: DiffReviewAction,
  options: DiffReviewActionOptions = {},
): DiffReviewResult<DiffReviewState> {
  if (options.readonly === true && DIFF_REVIEW_MUTATING_ACTION_TYPES.has(action.type)) {
    return {
      ok: false,
      error: {
        code: 'readonly',
        path: '',
        message: `'${action.type}' is disabled while the review is read-only.`,
      },
    };
  }

  const clock = options.clock ?? defaultDiffReviewClock;
  const idFactory = options.idFactory ?? defaultDiffReviewIdFactory;

  switch (action.type) {
    case 'set-targets':
      return applySetTargets(state, action);
    case 'select-target':
      return applySelectTarget(state, action);
    case 'select-file':
      return applySelectFile(state, action);
    case 'create-comment':
      return applyCreateComment(state, action, clock, idFactory);
    case 'edit-comment':
      return applyEditComment(state, action, clock);
    case 'delete-comment':
      return applyDeleteComment(state, action);
    case 'resolve-comment':
      return applyResolveComment(state, action, clock);
    case 'reopen-comment':
      return applyReopenComment(state, action, clock);
    case 'set-review-note':
      return applySetReviewNote(state, action);
    case 'set-reviewed':
      return applySetReviewed(state, action);
    case 'create-draft':
      return applyCreateDraft(state, action, clock, idFactory);
    case 'update-draft':
      return applyUpdateDraft(state, action, clock);
    case 'save-draft':
      return applySaveDraft(state, action, clock, idFactory);
    case 'discard-draft':
      return applyDiscardDraft(state, action);
  }
}
