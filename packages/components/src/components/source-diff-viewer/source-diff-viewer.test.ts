/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const {
  default: SourceDiffViewer,
  getSourceDiffFileLabel,
  parseUnifiedPatch,
  getSourceDiffLineLabel,
} = await import('./index.ts');

describe('SourceDiffViewer: unified source patches', () => {
  const patch = `diff --git a/src/one.ts b/src/one.ts
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

  test('parses file headers, hunk headers, line states, and line numbers', () => {
    const parsed = parseUnifiedPatch(patch);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.newPath).toBe('src/one.ts');
    expect(parsed.files[0]?.hunks[0]?.header).toBe('@@ -1,3 +1,4 @@');

    const firstHunkLines = parsed.files[0]?.hunks[0]?.lines ?? [];
    expect(firstHunkLines.map((line) => line.kind)).toEqual([
      'context',
      'removal',
      'addition',
      'addition',
      'context',
    ]);
    expect(firstHunkLines[1]).toMatchObject({
      oldLineNumber: 2,
      newLineNumber: null,
      content: "const label = 'old';",
    });
    expect(firstHunkLines[2]).toMatchObject({
      oldLineNumber: null,
      newLineNumber: 2,
      content: "const label = 'new';",
    });
  });

  test('renders multi-file source diffs with accessible addition and removal labels', () => {
    const { container } = render(SourceDiffViewer, { patch });

    expect(container.querySelectorAll('.cinder-source-diff-viewer__file')).toHaveLength(2);
    expect(container.textContent).toContain('src/one.ts');
    expect(container.textContent).toContain('src/two.ts');
    expect(container.textContent).toContain('@@ -1,3 +1,4 @@');

    expect(container.querySelectorAll("[data-cinder-line-kind='addition']")).toHaveLength(3);
    expect(container.querySelectorAll("[data-cinder-line-kind='removal']")).toHaveLength(2);
    expect(container.textContent).toContain("Added line 2: const label = 'new';");
    expect(container.textContent).toContain("Removed line 2: const label = 'old';");
  });

  test('can hide line-number gutters while preserving line-state labels', () => {
    const { container } = render(SourceDiffViewer, { patch, lineNumbers: false });

    expect(container.querySelector('.cinder-source-diff-viewer__line-number')).toBeNull();
    expect(container.textContent).toContain("Removed line 2: const label = 'old';");
  });

  test('bounds large patch rendering and reports the truncated total', () => {
    const parsed = parseUnifiedPatch(patch, { maxLines: 3 });
    expect(parsed.totalLineCount).toBe(8);
    expect(parsed.renderedLineCount).toBe(3);
    expect(parsed.truncated).toBe(true);

    const { container } = render(SourceDiffViewer, { patch, maxLines: 3 });
    expect(container.querySelectorAll('.cinder-source-diff-viewer__line')).toHaveLength(3);
    expect(container.textContent).toContain('Showing first 3 of 8 diff lines.');
  });

  test('renders the configured empty message when there are no diff rows', () => {
    const { container } = render(SourceDiffViewer, {
      patch: '',
      emptyMessage: 'Nothing changed.',
    });

    expect(container.querySelector('.cinder-source-diff-viewer__empty')?.textContent).toBe(
      'Nothing changed.',
    );
  });

  test('parses patches without git headers and preserves non-diff hunk metadata', () => {
    const parsed = parseUnifiedPatch(`--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -4 +4 @@
! not a diff row
-oldName();
+newName();
`);

    expect(parsed.files).toHaveLength(1);
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('src/old-name.ts -> src/new-name.ts');
    expect(parsed.files[0]?.metadata).toContain('! not a diff row');
    expect(parsed.files[0]?.hunks[0]?.lines).toHaveLength(2);
  });

  test('uses unknown line labels when a malformed hunk has no numeric cursor', () => {
    const parsed = parseUnifiedPatch(`diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ malformed @@
-old();
+new();
 unchanged();
`);

    const [removal, addition, context] = parsed.files[0]?.hunks[0]?.lines ?? [];
    expect(getSourceDiffLineLabel(removal!)).toBe('Removed line unknown: old();');
    expect(getSourceDiffLineLabel(addition!)).toBe('Added line unknown: new();');
    expect(getSourceDiffLineLabel(context!)).toBe('Context line unknown: unchanged();');
  });

  test('builds explicit labels for additions, removals, and context rows', () => {
    expect(
      getSourceDiffLineLabel({
        kind: 'addition',
        content: 'next();',
        oldLineNumber: null,
        newLineNumber: 9,
      }),
    ).toBe('Added line 9: next();');

    expect(
      getSourceDiffLineLabel({
        kind: 'removal',
        content: 'previous();',
        oldLineNumber: 8,
        newLineNumber: null,
      }),
    ).toBe('Removed line 8: previous();');

    expect(
      getSourceDiffLineLabel({
        kind: 'context',
        content: 'same();',
        oldLineNumber: 7,
        newLineNumber: 7,
      }),
    ).toBe('Context line 7: same();');
  });
});
