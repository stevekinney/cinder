/**
 * Public types for the diff-review agent export (DR-5, "Agent export contract" and "Export
 * literalness and existing threads").
 *
 * `exportDiffReviewMarkdown` and `exportDiffReviewJson` (in `diff-review-export.ts`) both build
 * one `DiffReviewExportModel` from a `DiffReviewState` and then render it — Markdown and JSON
 * agreeing on IDs, bodies, location, and state is a consequence of both formats rendering the
 * exact same model, not a rule each renderer separately upholds.
 *
 * @module
 */

import type { DiffReviewRawMapping, DiffReviewTargetKind } from '../diff-review-state/index.js';

/** Version 1 of the export document shape. There is no migration; a future incompatible shape
 * bumps this. */
export const DIFF_REVIEW_EXPORT_SCHEMA_VERSION = 1 as const;

/**
 * `'all'` (the default) exports every saved comment, including resolved and outdated ones.
 * `'unresolved'` excludes resolved diff comments; every retained existing-document thread is
 * still included, because existing document threads have no resolved state of their own and the
 * contract treats them as always open.
 */
export type DiffReviewExportScope = 'all' | 'unresolved';

/**
 * One message in an existing (pre-diff-review) document-anchored comment thread, exactly as
 * `comments/types.ts`'s own deletion predicate already expresses it: a message with a `deletedAt`
 * is excluded from export, exactly like `!comment.deletedAt` elsewhere in this package.
 *
 * This is a dedicated, minimal projection — not `comments/types.ts`'s `PersistedThread` — because
 * DR-5 owns only the exported shape of the existing-document variant; DR-7 owns projecting live
 * `ReviewEditor` state into it.
 */
export interface DiffReviewExportDocumentThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  deletedAt?: string | null | undefined;
}

/**
 * The existing-document anchor variant (contract, "Agent export contract": "existing document
 * threads use an explicit `document-text` or document-level anchor variant"). `'document'` mirrors
 * `comments/types.ts`'s own document-level anchor (no specific text); `'document-text'` carries the
 * TextQuoteSelector fields (`quote`/`prefix`/`suffix`) `shared/anchor-types.ts` already anchors a
 * live thread with, so a raw-source/normalized-markdown/existing-document-text coordinate can never
 * be mislabeled as another. DR-5 owns this full shape; DR-7 only supplies real values for it (its
 * own contract text: "does not defer or extend that schema").
 */
export type DiffReviewExportDocumentAnchor =
  | { kind: 'document' }
  | { kind: 'document-text'; quote: string; prefix: string | null; suffix: string | null };

/**
 * One existing document-anchored thread. `targetId` is the host-supplied identifier for the
 * document/session the thread belongs to (distinct from a `DiffReviewState` target); it namespaces
 * the thread's export ID together with `threadId`, so a document thread ID and a diff comment ID
 * can never collide even if they happen to be equal strings.
 */
export interface DiffReviewExportDocumentThread {
  targetId: string;
  threadId: string;
  createdAt: string;
  anchor: DiffReviewExportDocumentAnchor;
  messages: DiffReviewExportDocumentThreadMessage[];
}

export interface DiffReviewExportOptions {
  /** Default `'all'`. */
  scope?: DiffReviewExportScope | undefined;
  /** Default `'Review feedback'`. Rendered as the Markdown document's top-level heading. */
  reviewTitle?: string | undefined;
  /** Existing document-anchored threads to include alongside diff comments. Default `[]`. */
  documentThreads?: DiffReviewExportDocumentThread[] | undefined;
}

export type DiffReviewExportAnchor =
  | { kind: 'file' }
  | {
      kind: 'range';
      side: 'old' | 'new';
      startLine: number;
      endLine: number;
      coordinateSpace: 'raw-source' | 'normalized-markdown';
      /** Zero-based, as captured. Retained so the JSON handoff loses none of the anchor's
       * identifying coordinates ("Agent export contract": "captured anchor context without
       * loss"). */
      hunkOccurrence: number;
      /** The exact selected text, uncombined with context ("Source excerpts are labeled as
       * quoted material, separate from authored feedback"): the Markdown renderer derives its
       * own two-line-trimmed quote from this and `contextBefore`/`contextAfter` rather than the
       * model carrying two representations of the same excerpt that could drift apart. */
      selectedText: string;
      /** Every captured context line (up to three), untrimmed — the Markdown export quotes only
       * the nearest two per side; JSON keeps the full captured excerpt. */
      contextBefore: string[];
      contextAfter: string[];
    };

/** One exported diff-review comment. */
export interface DiffReviewExportDiffRecord {
  recordKind: 'diff';
  /** `JSON.stringify(['diff', commentId])` — the domain-tagged, collision-safe identifier. */
  exportId: string;
  commentId: string;
  targetId: string;
  /** Whether `targetId` is still present in the exported state's live target list. */
  current: boolean;
  targetKind: DiffReviewTargetKind;
  targetLabel: string;
  repositoryLabel: string | null;
  baseRevisionLabel: string | null;
  headRevisionLabel: string | null;
  snapshotId: string;
  fileOccurrence: number;
  oldPath: string | null;
  newPath: string | null;
  anchor: DiffReviewExportAnchor;
  rawMapping: DiffReviewRawMapping;
  body: string;
  resolved: boolean;
  outdated: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One message within an exported existing-document thread record. */
export interface DiffReviewExportDocumentMessageRecord {
  id: string;
  body: string;
  createdAt: string;
}

/** One exported existing-document thread, with its deleted messages already excluded. */
export interface DiffReviewExportDocumentRecord {
  recordKind: 'document';
  /** `JSON.stringify(['document', targetId, threadId])`. */
  exportId: string;
  targetId: string;
  threadId: string;
  createdAt: string;
  anchor: DiffReviewExportDocumentAnchor;
  messages: DiffReviewExportDocumentMessageRecord[];
}

export type DiffReviewExportRecord = DiffReviewExportDiffRecord | DiffReviewExportDocumentRecord;

export interface DiffReviewExportTotals {
  /** Diff comment records plus existing-document thread records. */
  records: number;
  /** Diff comment bodies plus every retained message body across existing-document threads. */
  messageBodies: number;
  /** Unresolved diff records plus every existing-document record (always open). */
  open: number;
  /** Resolved diff records. */
  resolved: number;
  /** Outdated diff records. */
  outdated: number;
}

/**
 * The complete, format-agnostic export model. `exportDiffReviewJson` serializes this directly;
 * `exportDiffReviewMarkdown` renders it into the Markdown handoff shape.
 */
export interface DiffReviewExportModel {
  schemaVersion: typeof DIFF_REVIEW_EXPORT_SCHEMA_VERSION;
  scope: DiffReviewExportScope;
  reviewTitle: string;
  /** Verbatim; `''` when the review has no note. */
  reviewNote: string;
  totals: DiffReviewExportTotals;
  /** Already fully ordered: see `diff-review-export-model.ts` for the sort contract. */
  records: DiffReviewExportRecord[];
}
