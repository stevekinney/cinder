/**
 * Export utilities for the ReviewEditor.
 *
 * Provides functions to generate LLM-friendly summaries and
 * Git-compatible unified diffs from review state.
 *
 * @module
 */

// Pure functions (for direct use/testing)
export { generateCommentsExport, generateCommentsJSON } from './comments-export.js';
export { generateMarkdownSummary } from './markdown-summary.js';
export { generateUnifiedDiff } from './unified-diff-generation.js';

/**
 * The diff-review agent handoff exporters (DR-5). Pure, DOM-free Markdown/JSON exporters for a
 * `DiffReviewState` — see `diff-review-export.ts`'s module doc.
 */
export { diffReviewExportJsonSchema } from './diff-review-export-schema.js';
export { exportDiffReviewJson, exportDiffReviewMarkdown } from './diff-review-export.js';

/**
 * Front-matter-aware document normalization shared by every export that diffs
 * or counts changes across a whole `ReviewState` document
 * (`generateUnifiedDiff`, `generateMarkdownSummary`, and the ReviewEditor
 * toolbar's `diffStats`). Exported so a future consumer computing its own
 * change count reuses this instead of re-deriving front-matter handling — see
 * the module doc in `normalize-document.ts` for why that has already gone
 * wrong twice (cinder#1307, cinder#1318).
 */
export { normalizeDocument, splitDocument } from './normalize-document.js';

// Types
export { DIFF_REVIEW_EXPORT_SCHEMA_VERSION } from './diff-review-export-types.js';
export type {
  DiffReviewExportAnchor,
  DiffReviewExportDiffRecord,
  DiffReviewExportDocumentAnchor,
  DiffReviewExportDocumentMessageRecord,
  DiffReviewExportDocumentRecord,
  DiffReviewExportDocumentThread,
  DiffReviewExportDocumentThreadMessage,
  DiffReviewExportModel,
  DiffReviewExportOptions,
  DiffReviewExportRecord,
  DiffReviewExportScope,
  DiffReviewExportTotals,
} from './diff-review-export-types.js';
export type { DocumentParts } from './normalize-document.js';
export type {
  CommentsExportOptions,
  CommentsExportResult,
  CommentsJSONOptions,
  CommentsJSONResult,
  ExportedComment,
  ExportedSelection,
  ExportedThread,
  MarkdownSummaryOptions,
  MarkdownSummaryResult,
  UnifiedDiffOptions,
  UnifiedDiffResult,
} from './types.js';
