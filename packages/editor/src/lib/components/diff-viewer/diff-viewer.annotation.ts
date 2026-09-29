/**
 * Pure, DOM-free selection logic for `DiffViewer`'s optional Markdown
 * annotation hooks (COR-514 / DR-4). Builds a single-line or contiguous-range
 * selection payload from row context and extends an existing selection on the
 * same side, rejecting an attempted cross-side or out-of-range extension with
 * an accessible explanation -- without moving the selection's origin.
 *
 * Deliberately narrower than `SourceDiffViewer`'s equivalent
 * (`source-diff-viewer.annotation.ts`, COR-515 / DR-3): a Markdown document is
 * one continuous flow of lines, not a file/hunk-partitioned patch, so there is
 * no `cross-file`/`cross-hunk` rejection here -- only `cross-side` and `edge`.
 * `hunkOccurrence` is still produced on every selection (to satisfy the
 * shared DR-2 anchor vocabulary in `@lostgradient/editor`'s
 * `diff-review-state` module, reused here by field name without importing
 * it), but it identifies the nearest change cluster for content-identity
 * purposes only; it never gates whether a selection can extend.
 *
 * No Svelte or DOM import here: this module is usable in SSR and from plain
 * unit tests, matching the rest of this component's dependency-light
 * utilities.
 *
 * @module
 */

import type { LineDiff } from '@lostgradient/markdown';

import type {
  DiffViewerAnnotationResult,
  DiffViewerAnnotationSelection,
  DiffViewerAnnotationSide,
  DiffViewerRawMapping,
} from './diff-viewer.types.ts';

const MAX_CONTEXT_LINES = 3;

/** A single point identifying one row: which side and which absolute line number. */
export type DiffViewerAnnotationPoint = {
  side: DiffViewerAnnotationSide;
  /** Absolute, front-matter-offset-inclusive, one-based line number on `side`. */
  line: number;
};

/** Per-row absolute line numbers (front-matter offset applied), both sides. */
export type DiffViewerRowLineNumbers = { oldLine: number | null; newLine: number | null };

/** A row addressable on one side, in document order. */
type SideRow = { index: number; line: number; text: string };

export interface DiffViewerAnnotationContext {
  lineDiffs: readonly LineDiff[];
  numbered: readonly DiffViewerRowLineNumbers[];
  normalizeInputs: boolean;
}

/**
 * Assigns direct, sequential one-based line numbers to every row of the
 * diffed body, offset by each side's leading front-matter line count
 * (`frontMatterLineCounts`, which may legitimately differ per side when
 * front matter itself changed length). CRLF is not special-cased here:
 * callers are expected to have counted front matter length with the same
 * separator rule (`/\r\n|\r|\n/`) this module's context capture uses, and a
 * `LineDiff`'s own line count is already CRLF-separator-count-stable because
 * every `\r\n` still contains exactly one `\n`.
 */
export function numberDiffViewerRows(
  lineDiffs: readonly LineDiff[],
  frontMatterLineCounts: { old: number; new: number },
): DiffViewerRowLineNumbers[] {
  let oldLine = frontMatterLineCounts.old + 1;
  let newLine = frontMatterLineCounts.new + 1;

  return lineDiffs.map((diff) => {
    if (diff.type === 'added') {
      const result = { oldLine: null, newLine };
      newLine += 1;
      return result;
    }
    if (diff.type === 'removed') {
      const result = { oldLine, newLine: null };
      oldLine += 1;
      return result;
    }
    // 'same' and 'modified' both occupy a position on both sides.
    const result = { oldLine, newLine };
    oldLine += 1;
    newLine += 1;
    return result;
  });
}

/**
 * Text on the given side of one row, or `null` when that side doesn't exist
 * there (an `added` row's old side, a `removed` row's new side). A trailing
 * carriage return is stripped so a CRLF-separated, non-normalized input never
 * leaks `\r` into a selected-text/context payload -- CRLF is one line
 * separator, not content.
 */
function textForSide(diff: LineDiff, side: DiffViewerAnnotationSide): string | null {
  const raw =
    diff.type === 'same'
      ? diff.text
      : diff.type === 'added'
        ? side === 'new'
          ? diff.text
          : null
        : diff.type === 'removed'
          ? side === 'old'
            ? diff.text
            : null
          : side === 'old'
            ? diff.oldText
            : diff.newText;
  return raw === null ? null : raw.replace(/\r$/, '');
}

/** Whether a row has any content on the given side at all (gates rendering an annotation control). */
export function isSideCommentable(diff: LineDiff, side: DiffViewerAnnotationSide): boolean {
  return textForSide(diff, side) !== null;
}

/** Every commentable row on one side, in document order, with that side's absolute line number and text. */
function rowsForSide(
  lineDiffs: readonly LineDiff[],
  numbered: readonly DiffViewerRowLineNumbers[],
  side: DiffViewerAnnotationSide,
): SideRow[] {
  const rows: SideRow[] = [];
  for (let index = 0; index < lineDiffs.length; index++) {
    const diff = lineDiffs[index];
    const numberedRow = numbered[index];
    if (!diff || !numberedRow) continue;
    const line = side === 'old' ? numberedRow.oldLine : numberedRow.newLine;
    const text = textForSide(diff, side);
    if (line === null || text === null) continue;
    rows.push({ index, line, text });
  }
  return rows;
}

function findRowIndex(rows: SideRow[], line: number): number {
  return rows.findIndex((row) => row.line === line);
}

function captureContext(
  rows: SideRow[],
  startIndex: number,
  endIndex: number,
): { contextBefore: string[]; contextAfter: string[] } {
  const beforeStart = Math.max(0, startIndex - MAX_CONTEXT_LINES);
  const afterEnd = Math.min(rows.length, endIndex + 1 + MAX_CONTEXT_LINES);
  return {
    contextBefore: rows.slice(beforeStart, startIndex).map((row) => row.text),
    contextAfter: rows.slice(endIndex + 1, afterEnd).map((row) => row.text),
  };
}

/**
 * Zero-based index of the nearest change cluster (a maximal run of non-`same`
 * rows) to `rowIndex`, or `0` when the document has no changes at all. A
 * stable identity value only -- see the module comment for why it never
 * gates selection extension.
 */
export function nearestChangeClusterIndex(
  lineDiffs: readonly LineDiff[],
  rowIndex: number,
): number {
  const clusters: Array<{ start: number; end: number }> = [];
  let clusterStart: number | null = null;
  for (let index = 0; index < lineDiffs.length; index++) {
    const isChange = lineDiffs[index]?.type !== 'same';
    if (isChange && clusterStart === null) clusterStart = index;
    if (!isChange && clusterStart !== null) {
      clusters.push({ start: clusterStart, end: index - 1 });
      clusterStart = null;
    }
  }
  if (clusterStart !== null) clusters.push({ start: clusterStart, end: lineDiffs.length - 1 });
  if (clusters.length === 0) return 0;

  let nearest = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  clusters.forEach((cluster, clusterIndex) => {
    const distance =
      rowIndex < cluster.start
        ? cluster.start - rowIndex
        : rowIndex > cluster.end
          ? rowIndex - cluster.end
          : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = clusterIndex;
    }
  });
  return nearest;
}

function rawMappingFor(normalizeInputs: boolean): DiffViewerRawMapping {
  return normalizeInputs ? { status: 'unavailable', reason: 'normalization' } : { status: 'exact' };
}

/**
 * Builds a single-line selection for one row on one side. Returns `null` when
 * the row is not commentable on that side -- callers must not commit an
 * anchor in that case.
 */
export function buildDiffViewerLineSelection(
  context: DiffViewerAnnotationContext,
  point: DiffViewerAnnotationPoint,
): DiffViewerAnnotationSelection | null {
  const { lineDiffs, numbered, normalizeInputs } = context;
  const rows = rowsForSide(lineDiffs, numbered, point.side);
  const index = findRowIndex(rows, point.line);
  if (index === -1) return null;

  const row = rows[index];
  if (!row) return null;
  const { contextBefore, contextAfter } = captureContext(rows, index, index);
  return {
    fileOccurrence: 0,
    hunkOccurrence: nearestChangeClusterIndex(lineDiffs, row.index),
    side: point.side,
    startLine: row.line,
    endLine: row.line,
    coordinateSpace: normalizeInputs ? 'normalized-markdown' : 'raw-source',
    rawMapping: rawMappingFor(normalizeInputs),
    selectedText: row.text,
    contextBefore,
    contextAfter,
  };
}

/**
 * Extends `origin` to `target` on the same side, or rejects an attempted
 * cross-side or out-of-range extension. A rejection never moves the origin --
 * callers keep using the same `origin` for the next attempt. Reversed
 * endpoints (target before origin) normalize to ascending line order.
 */
export function extendDiffViewerSelection(
  context: DiffViewerAnnotationContext,
  origin: DiffViewerAnnotationPoint,
  target: DiffViewerAnnotationPoint,
): DiffViewerAnnotationResult {
  if (target.side !== origin.side) {
    return {
      ok: false,
      reason: 'cross-side',
      message: 'A selection cannot extend to the other side of the diff.',
    };
  }

  const rows = rowsForSide(context.lineDiffs, context.numbered, origin.side);
  const originIndex = findRowIndex(rows, origin.line);
  if (originIndex === -1) {
    return { ok: false, reason: 'edge', message: 'The selection origin is no longer available.' };
  }

  const targetIndex = findRowIndex(rows, target.line);
  if (targetIndex === -1) {
    return {
      ok: false,
      reason: 'edge',
      message: 'The selection cannot extend past the top or bottom of the document.',
    };
  }

  const startIndex = Math.min(originIndex, targetIndex);
  const endIndex = Math.max(originIndex, targetIndex);
  const startRow = rows[startIndex];
  const endRow = rows[endIndex];
  if (!startRow || !endRow) {
    return { ok: false, reason: 'edge', message: 'The selection range is no longer available.' };
  }
  const { contextBefore, contextAfter } = captureContext(rows, startIndex, endIndex);
  const selectedText = rows
    .slice(startIndex, endIndex + 1)
    .map((row) => row.text)
    .join('\n');

  return {
    ok: true,
    selection: {
      fileOccurrence: 0,
      hunkOccurrence: nearestChangeClusterIndex(context.lineDiffs, startRow.index),
      side: origin.side,
      startLine: startRow.line,
      endLine: endRow.line,
      coordinateSpace: context.normalizeInputs ? 'normalized-markdown' : 'raw-source',
      rawMapping: rawMappingFor(context.normalizeInputs),
      selectedText,
      contextBefore,
      contextAfter,
    },
  };
}

/**
 * Best-effort `key:` extraction from changed front-matter lines, for the
 * "field context" ambiguous front matter offers alongside its file-level
 * comment hook. Ignores unchanged lines and non-field lines (delimiters,
 * blank lines, or content that isn't a plain `key:` pair) rather than
 * attempting a full YAML parse.
 */
export function extractFrontMatterChangedFields(diffs: readonly LineDiff[]): string[] {
  const fields = new Set<string>();
  const addFromLine = (text: string): void => {
    const match = /^\s*([A-Za-z0-9_-]+)\s*:/.exec(text);
    if (match?.[1]) fields.add(match[1]);
  };

  for (const diff of diffs) {
    if (diff.type === 'same') continue;
    if (diff.type === 'modified') {
      addFromLine(diff.oldText);
      addFromLine(diff.newText);
    } else {
      addFromLine(diff.text);
    }
  }
  return Array.from(fields);
}
