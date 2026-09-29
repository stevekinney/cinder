/**
 * Converts a viewer's controlled annotation selection into a
 * `DiffReviewRangeAnchor` (COR-509 / DR-6). `DiffReview` never imports
 * either viewer's controller — only the plain selection value shape COR-514
 * (`DiffViewer`) and COR-515 (`SourceDiffViewer`) already publish, which the
 * ratified contract designed to mirror `diff-review-state`'s own anchor
 * field vocabulary field-for-field.
 *
 * @module
 */

import type { SourceDiffAnnotationSelection } from '@lostgradient/cinder';

import type { DiffReviewAnchor } from '../../diff-review-state/index.ts';
import type { DiffViewerAnnotationSelection } from '../diff-viewer/diff-viewer.types.ts';

/**
 * `anchor` is the wider `DiffReviewAnchor` (not only the range anchor this
 * module builds) so `DiffReview`'s composer state can hold either this
 * bridge's range result or its own directly-constructed file anchor (for
 * "Add file comment") in one variable.
 */
export interface DiffReviewAnnotationBridgeResult {
  anchor: DiffReviewAnchor;
  oldPath: string | null;
  newPath: string | null;
}

/** A Markdown target has no file path of its own — always `null`. */
export function diffViewerSelectionToAnchor(
  selection: DiffViewerAnnotationSelection,
): DiffReviewAnnotationBridgeResult {
  return {
    anchor: {
      kind: 'range',
      fileOccurrence: selection.fileOccurrence,
      hunkOccurrence: selection.hunkOccurrence,
      side: selection.side,
      startLine: selection.startLine,
      endLine: selection.endLine,
      coordinateSpace: selection.coordinateSpace,
      selectedText: selection.selectedText,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
    },
    oldPath: null,
    newPath: null,
  };
}

/** A source patch selection is always `raw-source` and carries its file's own paths. */
export function sourceDiffSelectionToAnchor(
  selection: SourceDiffAnnotationSelection,
): DiffReviewAnnotationBridgeResult {
  return {
    anchor: {
      kind: 'range',
      fileOccurrence: selection.fileOccurrence,
      hunkOccurrence: selection.hunkOccurrence,
      side: selection.side,
      startLine: selection.startLine,
      endLine: selection.endLine,
      coordinateSpace: 'raw-source',
      selectedText: selection.selectedText,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
    },
    oldPath: selection.oldPath,
    newPath: selection.newPath,
  };
}
