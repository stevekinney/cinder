/**
 * Draft action handlers for `reduceDiffReviewState` (DR-2 normative handoff, "Drafts, modes, and
 * ReviewEditor").
 *
 * @module
 */

import { buildDiffReviewCapturedContext } from './captured-context.js';
import { nextDiffReviewUpdatedAt } from './clock.js';
import type {
  DiffReviewAction,
  DiffReviewComment,
  DiffReviewDraft,
  DiffReviewResult,
  DiffReviewState,
} from './types.js';
import { validateDiffReviewAnchor } from './validate-anchor.js';

function notFound(path: string) {
  return { code: 'invalid-record' as const, path, message: 'No such draft.' };
}

export function applyCreateDraft(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'create-draft' }>,
  clock: () => string,
  idFactory: () => string,
): DiffReviewResult<DiffReviewState> {
  const target = state.targets.find((t) => t.targetId === action.targetId);
  if (!target) {
    return {
      ok: false,
      error: { code: 'invalid-target', path: '/targetId', message: 'No such live target.' },
    };
  }

  const anchorResult = validateDiffReviewAnchor(action.anchor, '/anchor');
  if (!anchorResult.ok) return anchorResult;

  const draftId = action.draftId ?? idFactory();
  if (state.drafts.some((draft) => draft.draftId === draftId)) {
    return {
      ok: false,
      error: {
        code: 'duplicate-id',
        path: '/draftId',
        message: `Duplicate draft id '${draftId}'.`,
      },
    };
  }

  const now = clock();
  const draft: DiffReviewDraft = {
    draftId,
    targetId: action.targetId,
    anchor: anchorResult.value,
    capturedContext: buildDiffReviewCapturedContext(target, anchorResult.value, {
      oldPath: action.oldPath,
      newPath: action.newPath,
    }),
    body: action.body ?? '',
    createdAt: now,
    updatedAt: now,
    outdated: false,
  };

  return { ok: true, value: { ...state, drafts: [...state.drafts, draft] } };
}

export function applyUpdateDraft(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'update-draft' }>,
  clock: () => string,
): DiffReviewResult<DiffReviewState> {
  const index = state.drafts.findIndex((draft) => draft.draftId === action.draftId);
  if (index === -1) return { ok: false, error: notFound('/draftId') };

  const draft = state.drafts[index]!;
  const updated: DiffReviewDraft = {
    ...draft,
    body: action.body,
    updatedAt: nextDiffReviewUpdatedAt(draft.updatedAt, clock()),
  };
  const drafts = [...state.drafts];
  drafts[index] = updated;
  return { ok: true, value: { ...state, drafts } };
}

export function applyDiscardDraft(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'discard-draft' }>,
): DiffReviewResult<DiffReviewState> {
  if (!state.drafts.some((draft) => draft.draftId === action.draftId)) {
    return { ok: false, error: notFound('/draftId') };
  }
  return {
    ok: true,
    value: { ...state, drafts: state.drafts.filter((draft) => draft.draftId !== action.draftId) },
  };
}

/**
 * Saving converts a draft into a saved comment. When the draft's target is still live and its
 * content has not changed since the draft was created, the resulting comment is current;
 * otherwise (the target changed content, or was removed) it is created already outdated, using
 * the context captured at draft-creation time. A whitespace-only draft cannot be saved — it is
 * left exactly as it was, per the reducer's atomic error contract.
 */
export function applySaveDraft(
  state: DiffReviewState,
  action: Extract<DiffReviewAction, { type: 'save-draft' }>,
  clock: () => string,
  idFactory: () => string,
): DiffReviewResult<DiffReviewState> {
  const draft = state.drafts.find((d) => d.draftId === action.draftId);
  if (!draft) return { ok: false, error: notFound('/draftId') };

  if (draft.body.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-record',
        path: '/body',
        message: 'A whitespace-only draft cannot be saved.',
      },
    };
  }

  const id = action.id ?? idFactory();
  if (state.comments.some((comment) => comment.id === id)) {
    return {
      ok: false,
      error: { code: 'duplicate-id', path: '/id', message: `Duplicate comment id '${id}'.` },
    };
  }

  const liveTarget = state.targets.find((t) => t.targetId === draft.targetId);
  const outdated =
    draft.outdated ||
    liveTarget === undefined ||
    liveTarget.snapshotId !== draft.capturedContext.snapshotId;

  const now = clock();
  const comment: DiffReviewComment = {
    id,
    targetId: draft.targetId,
    snapshotId: draft.capturedContext.snapshotId,
    anchor: draft.anchor,
    capturedContext: draft.capturedContext,
    body: draft.body,
    createdAt: now,
    updatedAt: now,
    resolved: false,
    outdated,
  };

  return {
    ok: true,
    value: {
      ...state,
      comments: [...state.comments, comment],
      drafts: state.drafts.filter((d) => d.draftId !== action.draftId),
    },
  };
}
