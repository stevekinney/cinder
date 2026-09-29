/**
 * Public types for the revision-bound diff-review state model (COR-516 / DR-2).
 *
 * Pure, SSR-safe declarations. No module-level mutable state lives here or in any
 * sibling module — every function in this directory is a plain transform from
 * inputs to a new value.
 *
 * @module
 */

// ============================================================================
// Result
// ============================================================================

/** The finite set of error codes every diff-review-state operation can return. */
export type DiffReviewErrorCode =
  | 'unsupported-version'
  | 'invalid-target'
  | 'duplicate-id'
  | 'invalid-record'
  | 'invalid-anchor'
  | 'invalid-timestamp'
  | 'missing-context'
  | 'drafts-pending'
  | 'readonly';

/** A structured, JSON-Pointer-addressed validation error. */
export interface DiffReviewError {
  code: DiffReviewErrorCode;
  /** A JSON Pointer (RFC 6901) into the input that failed, or `''` for the whole input. */
  path: string;
  message: string;
}

export type DiffReviewResult<T> = { ok: true; value: T } | { ok: false; error: DiffReviewError };

// ============================================================================
// Targets
// ============================================================================

export type DiffReviewTargetKind = 'source' | 'markdown';

interface DiffReviewTargetInputBase {
  targetId: string;
  label: string;
  repositoryLabel?: string;
  baseRevisionLabel?: string;
  headRevisionLabel?: string;
}

export interface DiffReviewSourceTargetInput extends DiffReviewTargetInputBase {
  kind: 'source';
  patch: string;
}

export interface DiffReviewMarkdownTargetInput extends DiffReviewTargetInputBase {
  kind: 'markdown';
  original: string;
  current: string;
  /** Resolved boolean default from the viewer. Participates in content identity. */
  normalizeInputs: boolean;
}

export type DiffReviewTargetInput = DiffReviewSourceTargetInput | DiffReviewMarkdownTargetInput;

/** A live target descriptor tracked inside state, with its last observed content identity. */
export interface DiffReviewTargetRecord {
  targetId: string;
  kind: DiffReviewTargetKind;
  label: string;
  repositoryLabel: string | undefined;
  baseRevisionLabel: string | undefined;
  headRevisionLabel: string | undefined;
  snapshotId: string;
}

// ============================================================================
// Anchors
// ============================================================================

export type DiffReviewCoordinateSpace = 'raw-source' | 'normalized-markdown';

export interface DiffReviewFileAnchor {
  kind: 'file';
  fileOccurrence: number;
}

export interface DiffReviewRangeAnchor {
  kind: 'range';
  fileOccurrence: number;
  hunkOccurrence: number;
  side: 'old' | 'new';
  /** Inclusive, one-based. */
  startLine: number;
  /** Inclusive, one-based. */
  endLine: number;
  coordinateSpace: DiffReviewCoordinateSpace;
  selectedText: string;
  contextBefore: string[];
  contextAfter: string[];
}

export type DiffReviewAnchor = DiffReviewFileAnchor | DiffReviewRangeAnchor;

/** Raw mapping provenance for a range anchor's coordinate space (DR-2/DR-4 contract). */
export type DiffReviewRawMapping =
  { status: 'exact' } | { status: 'unavailable'; reason: 'normalization' };

// ============================================================================
// Captured context (retained even after the live target/file disappears)
// ============================================================================

export interface DiffReviewCapturedContext {
  targetKind: DiffReviewTargetKind;
  targetLabel: string;
  repositoryLabel: string | undefined;
  baseRevisionLabel: string | undefined;
  headRevisionLabel: string | undefined;
  oldPath: string | null;
  newPath: string | null;
  fileOccurrence: number;
  snapshotId: string;
  rawMapping: DiffReviewRawMapping;
}

// ============================================================================
// Comments
// ============================================================================

export interface DiffReviewComment {
  id: string;
  targetId: string;
  snapshotId: string;
  anchor: DiffReviewAnchor;
  capturedContext: DiffReviewCapturedContext;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  /** Latched once true. Set when the target's content or normalization changes. */
  outdated: boolean;
}

// ============================================================================
// Drafts
// ============================================================================

export interface DiffReviewDraft {
  draftId: string;
  targetId: string;
  anchor: DiffReviewAnchor;
  capturedContext: DiffReviewCapturedContext;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Latched once true, exactly like a comment's `outdated`. Never un-latches on revert. */
  outdated: boolean;
}

// ============================================================================
// Reviewed markers
// ============================================================================

export interface DiffReviewReviewedMarker {
  targetId: string;
  snapshotId: string;
  fileOccurrence: number;
}

// ============================================================================
// State
// ============================================================================

export const DIFF_REVIEW_STATE_VERSION = 1 as const;

export interface DiffReviewState {
  version: typeof DIFF_REVIEW_STATE_VERSION;
  targets: DiffReviewTargetRecord[];
  comments: DiffReviewComment[];
  drafts: DiffReviewDraft[];
  reviewNote: string;
  selectedTargetId: string | null;
  selectedFileOccurrence: number | null;
  reviewedMarkers: DiffReviewReviewedMarker[];
}

/** The JSON-safe shape `serializeDiffReviewState` produces and `restoreDiffReviewState` accepts. */
export type DiffReviewSerializedState = DiffReviewState;

// ============================================================================
// Host-supplied factories
// ============================================================================

export type DiffReviewClock = () => string;
export type DiffReviewIdFactory = () => string;

export interface DiffReviewActionOptions {
  readonly?: boolean;
  clock?: DiffReviewClock;
  idFactory?: DiffReviewIdFactory;
}

// ============================================================================
// Actions
// ============================================================================

export type DiffReviewAction =
  | { type: 'set-targets'; targets: DiffReviewTargetInput[] }
  | { type: 'select-target'; targetId: string | null }
  | { type: 'select-file'; fileOccurrence: number | null }
  | {
      type: 'create-comment';
      id?: string;
      targetId: string;
      anchor: DiffReviewAnchor;
      body: string;
      oldPath?: string | null;
      newPath?: string | null;
    }
  | { type: 'edit-comment'; id: string; body: string }
  | { type: 'delete-comment'; id: string }
  | { type: 'resolve-comment'; id: string }
  | { type: 'reopen-comment'; id: string }
  | { type: 'set-review-note'; body: string }
  | { type: 'set-reviewed'; targetId: string; fileOccurrence: number; reviewed: boolean }
  | {
      type: 'create-draft';
      draftId?: string;
      targetId: string;
      anchor: DiffReviewAnchor;
      body?: string;
      oldPath?: string | null;
      newPath?: string | null;
    }
  | { type: 'update-draft'; draftId: string; body: string }
  | { type: 'save-draft'; draftId: string; id?: string }
  | { type: 'discard-draft'; draftId: string };

/** Action types that mutate state and are therefore rejected with `readonly` in read-only mode. */
export const DIFF_REVIEW_MUTATING_ACTION_TYPES: ReadonlySet<DiffReviewAction['type']> = new Set([
  'create-comment',
  'edit-comment',
  'delete-comment',
  'resolve-comment',
  'reopen-comment',
  'set-review-note',
  'set-reviewed',
  'create-draft',
  'update-draft',
  'save-draft',
  'discard-draft',
]);
