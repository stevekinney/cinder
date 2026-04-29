/**
 * Position mapping between string offsets and AST source positions.
 *
 * This module bridges the gap between:
 * - diff-match-patch's string offsets (0-indexed character positions in UTF-16 code units)
 * - mdast's AST positions (1-indexed line/column with offset)
 *
 * The mapping enables "jump to change" navigation in the editor.
 */

import type { Root } from '../pipeline/index.js';
import { groupChangesByBlock } from './compute.js';
import type { Change, ChangeGroup, PositionEntry, SourcePosition } from './types.js';

function getPositionEntry(positionMap: PositionEntry[], index: number): PositionEntry {
  const entry = positionMap[index];
  if (entry === undefined) {
    throw new RangeError(`Expected position entry at index ${index}.`);
  }
  return entry;
}

/**
 * Build a position map from an AST for offset → position lookups.
 *
 * Creates sorted entries for each block in the AST, enabling binary
 * search to find which block contains a given string offset.
 */
export function buildPositionMap(ast: Root): PositionEntry[] {
  const entries: PositionEntry[] = [];

  ast.children.forEach((block, blockIndex) => {
    if (block.position?.start) {
      entries.push({
        offset: block.position.start.offset ?? 0,
        line: block.position.start.line,
        column: block.position.start.column,
        blockIndex,
        blockType: block.type,
      });
    }
  });

  // Sort by offset for binary search
  entries.sort((a, b) => a.offset - b.offset);
  return entries;
}

/**
 * Find the block containing a string offset using binary search.
 *
 * Returns the block whose start offset is closest to (but not exceeding)
 * the target offset. When source text is provided, computes accurate
 * line/column by counting newlines within the block.
 *
 * @param offset - Target offset to locate
 * @param positionMap - Sorted position entries from buildPositionMap
 * @param sourceText - Optional source text for accurate line/column calculation
 */
export function offsetToPosition(
  offset: number,
  positionMap: PositionEntry[],
  sourceText?: string,
): { position: SourcePosition; blockIndex: number; blockType: string } | null {
  if (positionMap.length === 0) return null;

  // Binary search for the block containing this offset
  let low = 0;
  let high = positionMap.length - 1;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (getPositionEntry(positionMap, mid).offset <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const entry = getPositionEntry(positionMap, low);

  // Calculate accurate line/column by counting newlines in the block
  let line = entry.line;
  let column = entry.column;

  if (sourceText) {
    // Walk from block start to target offset, counting newlines
    const blockStart = entry.offset;
    for (let i = blockStart; i < offset && i < sourceText.length; i++) {
      if (sourceText[i] === '\n') {
        line++;
        column = 1; // Reset to column 1 after newline
      } else {
        column++;
      }
    }
  } else {
    // Fallback: approximate column (useful for block-level navigation)
    const offsetWithinBlock = offset - entry.offset;
    column = entry.column + offsetWithinBlock;
  }

  return {
    position: {
      line,
      column,
      offset,
    },
    blockIndex: entry.blockIndex,
    blockType: entry.blockType,
  };
}

/**
 * Enrich changes with source positions and block information.
 *
 * Maps each change's string offset to its corresponding AST block,
 * enabling features like:
 * - Jump to change in editor
 * - Group changes by paragraph/heading/list
 * - Show block context in change panel
 *
 * @param changes - Changes to enrich
 * @param originalAst - AST of the original text
 * @param currentAst - AST of the current text
 * @param originalText - Optional original source text for accurate line/column
 * @param currentText - Optional current source text for accurate line/column
 */
export function enrichChangesWithPositions(
  changes: Change[],
  originalAst: Root,
  currentAst: Root,
  originalText?: string,
  currentText?: string,
): Change[] {
  const originalMap = buildPositionMap(originalAst);
  const currentMap = buildPositionMap(currentAst);

  return changes.map((change) => {
    // Use current position for insertions/replacements, original for deletions
    const offset = change.currentRange?.start ?? change.originalRange?.start ?? 0;
    const map = change.currentRange ? currentMap : originalMap;
    const sourceText = change.currentRange ? currentText : originalText;
    const posInfo = offsetToPosition(offset, map, sourceText);

    return {
      ...change,
      sourcePosition: posInfo?.position ?? null,
      blockIndex: posInfo?.blockIndex ?? 0,
      blockType: posInfo?.blockType ?? 'unknown',
    };
  });
}

/**
 * Full enrichment pipeline: adds positions and regroups changes.
 *
 * Call this after computeDiff() to complete the diff result with
 * accurate position information.
 *
 * @param changes - Changes to enrich
 * @param originalAst - AST of the original text
 * @param currentAst - AST of the current text
 * @param originalText - Optional original source text for accurate line/column
 * @param currentText - Optional current source text for accurate line/column
 */
export function enrichDiffWithPositions(
  changes: Change[],
  originalAst: Root,
  currentAst: Root,
  originalText?: string,
  currentText?: string,
): { changes: Change[]; groups: ChangeGroup[] } {
  const enrichedChanges = enrichChangesWithPositions(
    changes,
    originalAst,
    currentAst,
    originalText,
    currentText,
  );
  const groups = groupChangesByBlock(enrichedChanges);

  return { changes: enrichedChanges, groups };
}
