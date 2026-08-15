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
export { generateUnifiedDiff } from './unified-diff.js';

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
