import { describe, expect, test } from 'bun:test';

import type { SourceDiffAnnotationSelection } from '@lostgradient/cinder';
import type { DiffViewerAnnotationSelection } from '../diff-viewer/diff-viewer.types.ts';
import {
  diffViewerSelectionToAnchor,
  sourceDiffSelectionToAnchor,
} from './diff-review-annotation-bridge.ts';

describe('DiffReview component annotation bridge', () => {
  test('a DiffViewer selection becomes a range anchor with no file path', () => {
    const selection: DiffViewerAnnotationSelection = {
      fileOccurrence: 0,
      hunkOccurrence: 2,
      side: 'new',
      startLine: 5,
      endLine: 7,
      coordinateSpace: 'normalized-markdown',
      rawMapping: { status: 'unavailable', reason: 'normalization' },
      selectedText: 'changed text',
      contextBefore: ['before'],
      contextAfter: ['after'],
    };

    const result = diffViewerSelectionToAnchor(selection);
    expect(result.anchor).toEqual({
      kind: 'range',
      fileOccurrence: 0,
      hunkOccurrence: 2,
      side: 'new',
      startLine: 5,
      endLine: 7,
      coordinateSpace: 'normalized-markdown',
      selectedText: 'changed text',
      contextBefore: ['before'],
      contextAfter: ['after'],
    });
    expect(result.oldPath).toBeNull();
    expect(result.newPath).toBeNull();
  });

  test('a SourceDiffViewer selection becomes a raw-source range anchor carrying both paths', () => {
    const selection: SourceDiffAnnotationSelection = {
      fileOccurrence: 1,
      hunkOccurrence: 0,
      side: 'old',
      startLine: 10,
      endLine: 10,
      coordinateSpace: 'raw-source',
      selectedText: 'removed line',
      contextBefore: [],
      contextAfter: [],
      oldPath: 'src/two.ts',
      newPath: 'src/two.ts',
    };

    const result = sourceDiffSelectionToAnchor(selection);
    expect(result.anchor).toEqual({
      kind: 'range',
      fileOccurrence: 1,
      hunkOccurrence: 0,
      side: 'old',
      startLine: 10,
      endLine: 10,
      coordinateSpace: 'raw-source',
      selectedText: 'removed line',
      contextBefore: [],
      contextAfter: [],
    });
    expect(result.oldPath).toBe('src/two.ts');
    expect(result.newPath).toBe('src/two.ts');
  });
});
