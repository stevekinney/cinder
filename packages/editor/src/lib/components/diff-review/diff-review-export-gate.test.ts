import { describe, expect, test } from 'bun:test';

import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import { getDiffReviewExportGate } from './diff-review-export-gate.ts';

describe('DiffReview component export gate', () => {
  test('no drafts: export is not blocked', () => {
    const created = createDiffReviewState([
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'A',
        original: 'a',
        current: 'b',
        normalizeInputs: false,
      },
    ]);
    if (!created.ok) throw new Error('fixture setup failed');
    expect(getDiffReviewExportGate(created.value)).toEqual({ blocked: false, pendingCount: 0 });
  });

  test('a nonempty draft blocks export and reports its count', () => {
    const created = createDiffReviewState([
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'A',
        original: 'a',
        current: 'b',
        normalizeInputs: false,
      },
    ]);
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'in progress',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    expect(getDiffReviewExportGate(withDraft.value)).toEqual({ blocked: true, pendingCount: 1 });
  });

  test('a whitespace-only draft does not block export', () => {
    const created = createDiffReviewState([
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'A',
        original: 'a',
        current: 'b',
        normalizeInputs: false,
      },
    ]);
    if (!created.ok) throw new Error('fixture setup failed');
    const withDraft = reduceDiffReviewState(created.value, {
      type: 'create-draft',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: '   ',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');
    expect(getDiffReviewExportGate(withDraft.value)).toEqual({ blocked: false, pendingCount: 0 });
  });
});
