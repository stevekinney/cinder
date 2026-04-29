/**
 * Diff Engine - Public API
 *
 * DEP-42: Diff/Changeset Engine + Change Visualization
 *
 * This module provides word-level diffing for Markdown documents with:
 * - diff-match-patch based computation with semantic cleanup
 * - Position mapping to AST blocks for jump-to navigation
 *
 * @example
 * ```typescript
 * import { computeDiff } from '$lib/document/diff';
 *
 * const result = computeDiff(original, current);
 * console.log(result.changes); // Array of Change objects
 * console.log(result.stats);   // { insertions, deletions, replacements, ... }
 * ```
 *
 * @module
 */

// Core computation
export { computeDiff, groupChangesByBlock } from './compute.js';

// Position mapping
export {
  buildPositionMap,
  enrichChangesWithPositions,
  enrichDiffWithPositions,
  offsetToPosition,
} from './positions.js';

// Front matter support (DEP-61)
export {
  FRONTMATTER_BLOCK_INDEX,
  FRONTMATTER_BLOCK_TYPE,
  computeDiffWithFrontMatter,
  getBodyChanges,
  getFrontMatterChanges,
  isFrontMatterChange,
} from './frontmatter.js';
export type { DiffWithFrontMatterResult } from './frontmatter.js';

// Line-level diff (DEP-42)
export { computeLineDiff, computeWordChanges, getDiffStats, groupIntoHunks } from './line-diff.js';
export type { DiffHunk, LineDiff, LineDiffStats, WordChange } from './line-diff.js';

// Types
export type {
  Change,
  ChangeGroup,
  ChangeType,
  DiffMeta,
  DiffResult,
  DiffStats,
  PositionEntry,
  SourcePosition,
  TextRange,
  ViewMode,
} from './types.js';
