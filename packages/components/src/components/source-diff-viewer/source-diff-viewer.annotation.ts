/**
 * Pure, DOM-free selection logic for `SourceDiffViewer`'s optional annotation
 * hooks (COR-515 / DR-3). Builds a single-line or contiguous-range selection
 * payload from row context, extends an existing selection within the same
 * file/hunk/side, and rejects an attempted cross-file/hunk/side extension
 * with an accessible explanation — without moving the selection's origin.
 *
 * No Svelte, DOM, or component-runtime import here: this module is usable in
 * SSR and from plain unit tests, matching the rest of this component's
 * dependency-light utilities.
 *
 * @module
 */

import type {
  SourceDiffAnnotationResult,
  SourceDiffAnnotationSelection,
  SourceDiffAnnotationSide,
  SourceDiffFile,
  SourceDiffHunk,
  SourceDiffLine,
} from './source-diff-viewer.types.ts';

const MAX_CONTEXT_LINES = 3;

/** A row addressable on one side of a hunk, in document order. */
type SideRow = {
  line: SourceDiffLine;
  lineNumber: number;
};

/** A single point identifying one row: which file, hunk, side, and line. */
export type SourceDiffAnnotationPoint = {
  fileOccurrence: number;
  hunkOccurrence: number;
  side: SourceDiffAnnotationSide;
  line: number;
};

/**
 * Whether a row can ever anchor a comment: additions, removals, and context
 * rows are commentable; metadata rows (binary notices, truncation markers,
 * `\ No newline at end of file`, and any other non-content row) never are,
 * regardless of side.
 */
export function isLineCommentable(line: SourceDiffLine): boolean {
  return line.kind !== 'metadata';
}

/**
 * The side(s) a row can be commented on. Additions only ever exist on the new
 * side; removals only on the old side; context rows are dual-sided (either
 * explicit control is valid) as long as they carry a line number for that
 * side. Metadata rows are never commentable on any side.
 */
export function commentableSidesForLine(line: SourceDiffLine): SourceDiffAnnotationSide[] {
  if (!isLineCommentable(line)) return [];
  const sides: SourceDiffAnnotationSide[] = [];
  if (line.oldLineNumber !== null) sides.push('old');
  if (line.newLineNumber !== null) sides.push('new');
  return sides;
}

function lineNumberForSide(line: SourceDiffLine, side: SourceDiffAnnotationSide): number | null {
  return side === 'old' ? line.oldLineNumber : line.newLineNumber;
}

/** Every commentable row of a hunk on one side, in document order. */
function rowsForSide(hunk: SourceDiffHunk, side: SourceDiffAnnotationSide): SideRow[] {
  const rows: SideRow[] = [];
  for (const line of hunk.lines) {
    if (!isLineCommentable(line)) continue;
    const lineNumber = lineNumberForSide(line, side);
    if (lineNumber === null) continue;
    rows.push({ line, lineNumber });
  }
  return rows;
}

function findRowIndex(rows: SideRow[], lineNumber: number): number {
  return rows.findIndex((row) => row.lineNumber === lineNumber);
}

function captureContext(
  rows: SideRow[],
  startIndex: number,
  endIndex: number,
): { contextBefore: string[]; contextAfter: string[] } {
  const beforeStart = Math.max(0, startIndex - MAX_CONTEXT_LINES);
  const afterEnd = Math.min(rows.length, endIndex + 1 + MAX_CONTEXT_LINES);
  return {
    contextBefore: rows.slice(beforeStart, startIndex).map((row) => row.line.content),
    contextAfter: rows.slice(endIndex + 1, afterEnd).map((row) => row.line.content),
  };
}

/**
 * Builds a single-line selection for one row on one side. Returns `null` when
 * the row is not commentable on that side (metadata row, or the given side
 * has no line number there) — callers must not commit an anchor in that case.
 */
export function buildLineSelection(
  file: Pick<SourceDiffFile, 'fileOccurrence' | 'oldPath' | 'newPath'>,
  hunk: SourceDiffHunk,
  side: SourceDiffAnnotationSide,
  lineNumber: number,
): SourceDiffAnnotationSelection | null {
  const rows = rowsForSide(hunk, side);
  const index = findRowIndex(rows, lineNumber);
  if (index === -1) return null;

  const { contextBefore, contextAfter } = captureContext(rows, index, index);
  return {
    fileOccurrence: file.fileOccurrence,
    hunkOccurrence: hunk.hunkOccurrence,
    side,
    startLine: lineNumber,
    endLine: lineNumber,
    coordinateSpace: 'raw-source',
    selectedText: rows[index]!.line.content,
    contextBefore,
    contextAfter,
    oldPath: file.oldPath,
    newPath: file.newPath,
  };
}

/**
 * Extends an existing origin point to a new target point on the same
 * file/hunk/side, or rejects the attempt when the target crosses a file,
 * hunk, or side boundary. A rejection never moves the origin — callers keep
 * using the same `origin` for the next attempt. Reversed endpoints (target
 * before origin) normalize to ascending line order.
 */
export function extendLineSelection(
  file: Pick<SourceDiffFile, 'fileOccurrence' | 'oldPath' | 'newPath'>,
  hunk: SourceDiffHunk,
  origin: SourceDiffAnnotationPoint,
  target: SourceDiffAnnotationPoint,
): SourceDiffAnnotationResult {
  if (target.fileOccurrence !== origin.fileOccurrence) {
    return {
      ok: false,
      reason: 'cross-file',
      message: 'A selection cannot extend into a different file.',
    };
  }
  if (target.hunkOccurrence !== origin.hunkOccurrence) {
    return {
      ok: false,
      reason: 'cross-hunk',
      message: 'A selection cannot extend into a different hunk.',
    };
  }
  if (target.side !== origin.side) {
    return {
      ok: false,
      reason: 'cross-side',
      message: 'A selection cannot extend to the other side of the diff.',
    };
  }

  const rows = rowsForSide(hunk, origin.side);
  const originIndex = findRowIndex(rows, origin.line);
  if (originIndex === -1) {
    return {
      ok: false,
      reason: 'cross-hunk',
      message: 'The selection origin is no longer part of this hunk.',
    };
  }

  const targetIndex = findRowIndex(rows, target.line);
  if (targetIndex === -1) {
    return {
      ok: false,
      reason: 'edge',
      message: 'The selection cannot extend past the top or bottom of this hunk.',
    };
  }

  const startIndex = Math.min(originIndex, targetIndex);
  const endIndex = Math.max(originIndex, targetIndex);
  const { contextBefore, contextAfter } = captureContext(rows, startIndex, endIndex);
  const selectedText = rows
    .slice(startIndex, endIndex + 1)
    .map((row) => row.line.content)
    .join('\n');

  return {
    ok: true,
    selection: {
      fileOccurrence: file.fileOccurrence,
      hunkOccurrence: hunk.hunkOccurrence,
      side: origin.side,
      startLine: rows[startIndex]!.lineNumber,
      endLine: rows[endIndex]!.lineNumber,
      coordinateSpace: 'raw-source',
      selectedText,
      contextBefore,
      contextAfter,
      oldPath: file.oldPath,
      newPath: file.newPath,
    },
  };
}
