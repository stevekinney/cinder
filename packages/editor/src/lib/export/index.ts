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

// Types
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
