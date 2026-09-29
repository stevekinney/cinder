import { describe, expect, test } from 'bun:test';

import type { DiffReviewTargetInput } from '../../diff-review-state/index.ts';
import { createDiffReviewState, reduceDiffReviewState } from '../../diff-review-state/index.ts';
import { buildDiffReviewFileEntries } from './diff-review-file-entries.ts';

const sourcePatch = `diff --git a/src/one.ts b/src/one.ts
index 1111111..2222222 100644
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,3 +1,4 @@
 const keep = true;
-const label = 'old';
+const label = 'new';
+const count = 1;
 export { label };
diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -10,2 +10,2 @@
-oldTwo();
+newTwo();
 unchanged();
`;

describe('DiffReview component file entries', () => {
  test('a markdown target produces exactly one file entry with a changed-line count', () => {
    const targets: DiffReviewTargetInput[] = [
      {
        targetId: 't1',
        kind: 'markdown',
        label: 'README.md',
        original: 'line one\nline two',
        current: 'line one\nline TWO',
        normalizeInputs: false,
      },
    ];
    const created = createDiffReviewState(targets);
    if (!created.ok) throw new Error('fixture setup failed');

    const entries = buildDiffReviewFileEntries(targets, created.value);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      targetId: 't1',
      fileOccurrence: 0,
      path: 'README.md',
      commentCount: 0,
      draftCount: 0,
      reviewed: false,
    });
    expect(entries[0]?.changedLineCount).toBeGreaterThan(0);
  });

  test('a source target produces one file entry per parsed file, in patch order', () => {
    const targets: DiffReviewTargetInput[] = [
      { targetId: 't1', kind: 'source', label: 'Patch', patch: sourcePatch },
    ];
    const created = createDiffReviewState(targets);
    if (!created.ok) throw new Error('fixture setup failed');

    const entries = buildDiffReviewFileEntries(targets, created.value);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.path).toBe('src/one.ts');
    expect(entries[0]?.fileOccurrence).toBe(0);
    expect(entries[0]?.changedLineCount).toBe(3);
    expect(entries[1]?.path).toBe('src/two.ts');
    expect(entries[1]?.fileOccurrence).toBe(1);
  });

  test('comment and draft counts reflect state scoped to the exact target/file pair', () => {
    const targets: DiffReviewTargetInput[] = [
      { targetId: 't1', kind: 'source', label: 'Patch', patch: sourcePatch },
    ];
    const created = createDiffReviewState(targets);
    if (!created.ok) throw new Error('fixture setup failed');

    const withComment = reduceDiffReviewState(created.value, {
      type: 'create-comment',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 1 },
      body: 'Looks off',
    });
    if (!withComment.ok) throw new Error('fixture setup failed');

    const withDraft = reduceDiffReviewState(withComment.value, {
      type: 'create-draft',
      targetId: 't1',
      anchor: { kind: 'file', fileOccurrence: 0 },
      body: 'wip',
    });
    if (!withDraft.ok) throw new Error('fixture setup failed');

    const entries = buildDiffReviewFileEntries(targets, withDraft.value);
    expect(entries[0]).toMatchObject({ fileOccurrence: 0, commentCount: 0, draftCount: 1 });
    expect(entries[1]).toMatchObject({ fileOccurrence: 1, commentCount: 1, draftCount: 0 });
  });

  test('a reviewed marker for the current snapshot marks its file entry reviewed', () => {
    const targets: DiffReviewTargetInput[] = [
      { targetId: 't1', kind: 'source', label: 'Patch', patch: sourcePatch },
    ];
    const created = createDiffReviewState(targets);
    if (!created.ok) throw new Error('fixture setup failed');

    const reviewed = reduceDiffReviewState(created.value, {
      type: 'set-reviewed',
      targetId: 't1',
      fileOccurrence: 0,
      reviewed: true,
    });
    if (!reviewed.ok) throw new Error('fixture setup failed');

    const entries = buildDiffReviewFileEntries(targets, reviewed.value);
    expect(entries[0]?.reviewed).toBe(true);
    expect(entries[1]?.reviewed).toBe(false);
  });
});
