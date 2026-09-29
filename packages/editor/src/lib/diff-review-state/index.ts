/**
 * Revision-bound diff-review state and persistence (COR-516 / DR-2).
 *
 * Pure, SSR-safe model for a diff-review session: comments, drafts, a review note, reviewed
 * markers, and content-addressed identity, independent of any renderer. Public at
 * `@lostgradient/editor/diff-review-state`. See `docs/decisions/diff-review-contract.md` (in
 * this package's `documentation/` directory) for the ratified product/architecture contract this
 * module implements.
 *
 * @module
 */

export { createDiffReviewState } from './create.js';
export { computeDiffReviewSnapshotId } from './identity.js';
export { reduceDiffReviewState } from './reduce.js';
export { restoreDiffReviewState } from './restore.js';
export { serializeDiffReviewState } from './serialize.js';

export {
  defaultDiffReviewClock,
  defaultDiffReviewIdFactory,
  isCanonicalDiffReviewTimestamp,
  nextDiffReviewUpdatedAt,
} from './clock.js';

export {
  ensureDiffReviewNoPendingDrafts,
  getDiffReviewPendingDrafts,
  isDiffReviewFileReviewed,
} from './query.js';

export { buildDiffReviewCapturedContext } from './captured-context.js';
export { validateDiffReviewAnchor } from './validate-anchor.js';
export { validateSerializedDiffReviewState } from './validate-serialized.js';
export { validateDiffReviewTargetList } from './validate-targets.js';

export {
  duplicateCommentIdStateFixture,
  duplicateTargetIdFixtures,
  invalidTargetKindFixture,
  invalidTargetPatchFixture,
  invalidTimestampStateFixture,
  repeatedPathTargetFixtures,
  unknownTopLevelKeyStateFixture,
  unsupportedVersionStateFixture,
  validMarkdownTargetFixture,
  validSerializedStateFixture,
  validSourceTargetFixture,
} from './fixtures.js';

export { DIFF_REVIEW_MUTATING_ACTION_TYPES, DIFF_REVIEW_STATE_VERSION } from './types.js';

export type {
  DiffReviewAction,
  DiffReviewActionOptions,
  DiffReviewAnchor,
  DiffReviewCapturedContext,
  DiffReviewClock,
  DiffReviewComment,
  DiffReviewCoordinateSpace,
  DiffReviewDraft,
  DiffReviewError,
  DiffReviewErrorCode,
  DiffReviewFileAnchor,
  DiffReviewIdFactory,
  DiffReviewMarkdownTargetInput,
  DiffReviewRangeAnchor,
  DiffReviewRawMapping,
  DiffReviewResult,
  DiffReviewReviewedMarker,
  DiffReviewSerializedState,
  DiffReviewSourceTargetInput,
  DiffReviewState,
  DiffReviewTargetInput,
  DiffReviewTargetKind,
  DiffReviewTargetRecord,
} from './types.js';
