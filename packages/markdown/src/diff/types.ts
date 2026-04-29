/**
 * Types for the diff engine.
 *
 * These types represent the core data structures for computing and
 * displaying differences between two Markdown documents.
 */

/** Range in a string (0-indexed character offsets in UTF-16 code units) */
export interface TextRange {
  start: number;
  end: number;
}

/** AST position (1-indexed line/column, 0-indexed offset) */
export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

/** Type of change in the diff */
export type ChangeType = 'insertion' | 'deletion' | 'replacement';

/** Single change in the diff */
export interface Change {
  /** Unique ID for keying in Svelte loops */
  id: string;
  /** Type of change */
  type: ChangeType;
  /** Original text (empty for insertions) */
  originalText: string;
  /** Current text (empty for deletions) */
  currentText: string;
  /** Position in original document */
  originalRange: TextRange | null;
  /** Position in current document */
  currentRange: TextRange | null;
  /** Source position for jump-to navigation */
  sourcePosition: SourcePosition | null;
  /** Which block this change belongs to */
  blockIndex: number;
  /** Type of the containing block */
  blockType: string;
}

/** Grouped changes for panel display */
export interface ChangeGroup {
  blockIndex: number;
  blockType: string;
  changes: Change[];
}

/** Statistics about the diff */
export interface DiffStats {
  insertions: number;
  deletions: number;
  replacements: number;
  wordsAdded: number;
  wordsRemoved: number;
}

/** Metadata about the diff computation */
export interface DiffMeta {
  computeTimeMs: number;
  originalSize: number;
  currentSize: number;
  usedWorker: boolean;
}

/** Full diff result */
export interface DiffResult {
  changes: Change[];
  groups: ChangeGroup[];
  stats: DiffStats;
  meta: DiffMeta;
}

/** View mode for the diff viewer */
export type ViewMode = 'changes' | 'final' | 'original';

/** Entry in the position map for offset lookups */
export interface PositionEntry {
  offset: number;
  line: number;
  column: number;
  blockIndex: number;
  blockType: string;
}
