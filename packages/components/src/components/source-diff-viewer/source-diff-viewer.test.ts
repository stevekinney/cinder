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
    expect(container.querySelector('.cinder-source-diff-viewer__lines')?.getAttribute('role')).toBe(
      'group',
    );
    expect(
      container.querySelector('.cinder-source-diff-viewer__lines')?.getAttribute('aria-label'),
    ).toBe('src/one.ts @@ -1,3 +1,4 @@ lines');

    expect(container.querySelectorAll("[data-cinder-line-kind='addition']")).toHaveLength(3);
    expect(container.querySelectorAll("[data-cinder-line-kind='removal']")).toHaveLength(2);
    expect(container.textContent).toContain("Added line 2: const label = 'new';");
    expect(container.textContent).toContain("Removed line 2: const label = 'old';");
  });

  test('forwards native attributes while preserving the component region role', () => {
    const { container } = render(SourceDiffViewer, {
      patch,
      id: 'review-diff',
      'data-testid': 'source-diff',
      role: 'presentation',
    });

    const root = container.querySelector('.cinder-source-diff-viewer');
    expect(root?.getAttribute('id')).toBe('review-diff');
    expect(root?.getAttribute('data-testid')).toBe('source-diff');
    expect(root?.getAttribute('role')).toBe('region');
  });

  test('uses the default aria label when the custom label is blank', () => {
    const { container } = render(SourceDiffViewer, { patch, ariaLabel: '   ' });

    expect(container.querySelector('.cinder-source-diff-viewer')?.hasAttribute('aria-label')).toBe(
      true,
    );
    expect(container.querySelector('.cinder-source-diff-viewer')?.getAttribute('aria-label')).toBe(
      'Source diff',
    );
  });

  test('uses a native aria-label when the custom ariaLabel prop is not supplied', () => {
    const { container } = render(SourceDiffViewer, {
      patch,
      'aria-label': 'Repository patch',
    });

    expect(container.querySelector('.cinder-source-diff-viewer')?.getAttribute('aria-label')).toBe(
      'Repository patch',
    );
  });

  test('honors aria-labelledby instead of overriding it with aria-label', () => {
    const { container } = render(SourceDiffViewer, {
      patch,
      'aria-labelledby': 'diff-heading',
    });

    const root = container.querySelector('.cinder-source-diff-viewer');
    expect(root?.getAttribute('aria-labelledby')).toBe('diff-heading');
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('can hide line-number gutters while preserving line-state labels', () => {
    const { container } = render(SourceDiffViewer, { patch, lineNumbers: false });

    expect(container.querySelector('.cinder-source-diff-viewer__line-number')).toBeNull();
    expect(container.textContent).toContain("Removed line 2: const label = 'old';");
  });

  test('bounds large patch rendering and reports the truncated total', () => {
    const parsed = parseUnifiedPatch(patch, { maxLines: 3 });
    expect(parsed.totalLineCount).toBe(9);
    expect(parsed.renderedLineCount).toBe(3);
    expect(parsed.truncated).toBe(true);

    const { container } = render(SourceDiffViewer, { patch, maxLines: 3 });
    expect(container.querySelectorAll('.cinder-source-diff-viewer__metadata code')).toHaveLength(1);
    expect(container.querySelectorAll('.cinder-source-diff-viewer__line')).toHaveLength(2);
    expect(container.textContent).toContain('Showing first 3 of 9 diff lines.');
  });

  test('shows truncation rather than the empty state when maxLines is zero', () => {
    const { container } = render(SourceDiffViewer, { patch, maxLines: 0 });

    expect(container.querySelector('.cinder-source-diff-viewer__empty')).toBeNull();
    expect(container.textContent).toContain('Showing first 0 of 9 diff lines.');
  });

  test('does not keep empty file sections when truncation stops before later hunks', () => {
    const parsed = parseUnifiedPatch(patch, { maxLines: 5 });

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.newPath).toBe('src/one.ts');
    expect(parsed.truncated).toBe(true);
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

  test('renders metadata-only patch content instead of the empty state', () => {
    const { container } = render(SourceDiffViewer, {
      patch: `diff --git a/assets/icon.png b/assets/icon.png
new file mode 100644
Binary files /dev/null and b/assets/icon.png differ
`,
    });

    expect(container.querySelector('.cinder-source-diff-viewer__empty')).toBeNull();
    expect(container.textContent).toContain('Binary files /dev/null and b/assets/icon.png differ');
  });

  test('parses patches without git headers and preserves non-diff hunk metadata verbatim', () => {
    const parsed = parseUnifiedPatch(`--- src/old-name.ts
+++ src/new-name.ts
@@ -4 +4 @@
! not a diff row
-oldName();
+newName();
`);

    expect(parsed.files).toHaveLength(1);
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('src/old-name.ts -> src/new-name.ts');
    expect(parsed.files[0]?.metadata).toEqual([]);
    expect(parsed.files[0]?.hunks[0]?.lines).toMatchObject([
      { kind: 'metadata', content: '! not a diff row' },
      { kind: 'removal', content: 'oldName();' },
      { kind: 'addition', content: 'newName();' },
    ]);

    const { container } = render(SourceDiffViewer, {
      patch: `--- src/old-name.ts
+++ src/new-name.ts
@@ -4 +4 @@
! not a diff row
-oldName();
+newName();
`,
    });

    const renderedRows = [
      ...container.querySelectorAll('.cinder-source-diff-viewer__line-code'),
    ].map((element) => element.textContent);
    expect(renderedRows).toContain('! not a diff row');
    expect(renderedRows).not.toContain('\\ ! not a diff row');
  });

  test('does not strip real a or b path segments from labels after parsing', () => {
    const parsed = parseUnifiedPatch(`diff --git a/a/foo.ts b/a/foo.ts
--- a/a/foo.ts
+++ b/a/foo.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('a/foo.ts');
    expect(parsed.files[0]?.newPath).toBe('a/foo.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('a/foo.ts');
  });

  test('decodes quoted git paths before stripping synthetic prefixes', () => {
    const parsed = parseUnifiedPatch(`diff --git "a/caf\\303\\251.ts" "b/caf\\303\\251.ts"
--- "a/caf\\303\\251.ts"
+++ "b/caf\\303\\251.ts"
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('café.ts');
    expect(parsed.files[0]?.newPath).toBe('café.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('café.ts');
  });

  test('parses git headers when paths contain embedded b segments', () => {
    const parsed = parseUnifiedPatch(`diff --git a/foo b/bar b/foo b/bar
old mode 100644
new mode 100755
`);

    expect(parsed.files[0]?.oldPath).toBe('foo b/bar');
    expect(parsed.files[0]?.newPath).toBe('foo b/bar');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('foo b/bar');
  });

  test('parses quoted git headers without later file headers', () => {
    const parsed = parseUnifiedPatch(`diff --git "a/caf\\303\\251.sh" "b/caf\\303\\251.sh"
old mode 100644
new mode 100755
`);

    expect(parsed.files[0]?.oldPath).toBe('café.sh');
    expect(parsed.files[0]?.newPath).toBe('café.sh');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('café.sh');
  });

  test('preserves verbatim UTF-8 characters in quoted git paths', () => {
    const parsed = parseUnifiedPatch(`diff --git "a/café \\"x\\".txt" "b/café \\"x\\".txt"
old mode 100644
new mode 100755
`);

    expect(parsed.files[0]?.oldPath).toBe('café "x".txt');
    expect(parsed.files[0]?.newPath).toBe('café "x".txt');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('café "x".txt');
  });

  test('uses rename metadata for git headers with ambiguous b segments', () => {
    const parsed = parseUnifiedPatch(`diff --git a/one b/two b/bar
similarity index 100%
rename from one
rename to two b/bar
`);

    expect(parsed.files[0]?.oldPath).toBe('one');
    expect(parsed.files[0]?.newPath).toBe('two b/bar');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('one -> two b/bar');
  });

  test('uses copy metadata for git headers with ambiguous b segments', () => {
    const parsed = parseUnifiedPatch(`diff --git a/one b/two b/bar
similarity index 100%
copy from one
copy to two b/bar
`);

    expect(parsed.files[0]?.oldPath).toBe('one');
    expect(parsed.files[0]?.newPath).toBe('two b/bar');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('one -> two b/bar');
  });

  test('normalizes custom git diff prefixes', () => {
    const parsed = parseUnifiedPatch(`diff --git old/src/example.ts new/src/example.ts
--- old/src/example.ts
+++ new/src/example.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('src/example.ts');
    expect(parsed.files[0]?.newPath).toBe('src/example.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('src/example.ts');
  });

  test('preserves real path segments after default git prefixes', () => {
    const parsed =
      parseUnifiedPatch(`diff --git a/packages/components/foo.ts b/packages/components/foo.ts
--- a/packages/components/foo.ts
+++ b/packages/components/foo.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('packages/components/foo.ts');
    expect(parsed.files[0]?.newPath).toBe('packages/components/foo.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('packages/components/foo.ts');
  });

  test('preserves shared path segments after custom git diff prefixes', () => {
    const parsed = parseUnifiedPatch(`diff --git old/root/src/example.ts new/root/src/example.ts
--- old/root/src/example.ts
+++ new/root/src/example.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('root/src/example.ts');
    expect(parsed.files[0]?.newPath).toBe('root/src/example.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('root/src/example.ts');
  });

  test('parses no-prefix git diff headers without stripping real paths', () => {
    const parsed = parseUnifiedPatch(`diff --git src/example.ts src/example.ts
--- src/example.ts
+++ src/example.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('src/example.ts');
    expect(parsed.files[0]?.newPath).toBe('src/example.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('src/example.ts');
  });

  test('preserves a and b roots in non-git unified patch headers', () => {
    const parsed = parseUnifiedPatch(`--- a/foo.ts
+++ b/foo.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('a/foo.ts');
    expect(parsed.files[0]?.newPath).toBe('b/foo.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('a/foo.ts -> b/foo.ts');
  });

  test('strips diff -u timestamps from non-git file headers', () => {
    const parsed = parseUnifiedPatch(`--- src/example.ts\t2026-07-05 10:00:00
+++ src/example.ts\t2026-07-05 10:01:00
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.oldPath).toBe('src/example.ts');
    expect(parsed.files[0]?.newPath).toBe('src/example.ts');
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('src/example.ts');
  });

  test('parses multi-file unified patches without diff git separators', () => {
    const parsed = parseUnifiedPatch(`--- src/one.ts
+++ src/one.ts
@@ -1 +1 @@
-one();
+oneUpdated();
--- src/two.ts
+++ src/two.ts
@@ -1 +1 @@
-two();
+twoUpdated();
`);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.newPath).toBe('src/one.ts');
    expect(parsed.files[1]?.newPath).toBe('src/two.ts');
    expect(parsed.files[1]?.hunks[0]?.lines[1]?.content).toBe('twoUpdated();');
  });

  test('treats hunk rows that start with --- or +++ as source lines', () => {
    const parsed = parseUnifiedPatch(`diff --git a/src/comments.sql b/src/comments.sql
--- a/src/comments.sql
+++ b/src/comments.sql
@@ -1,2 +1,2 @@
--- old comment
+++ new comment
 SELECT 1;
`);

    const lines = parsed.files[0]?.hunks[0]?.lines ?? [];
    expect(lines).toMatchObject([
      { kind: 'removal', content: '-- old comment' },
      { kind: 'addition', content: '++ new comment' },
      { kind: 'context', content: 'SELECT 1;' },
    ]);
    expect(parsed.files[0]?.oldPath).toBe('src/comments.sql');
    expect(parsed.files[0]?.newPath).toBe('src/comments.sql');
  });

  test('keeps no-newline markers in hunk order', () => {
    const parsed = parseUnifiedPatch(`diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-old();
\\ No newline at end of file
+new();
\\ No newline at end of file
`);

    expect(parsed.files[0]?.metadata).toEqual([]);
    expect(parsed.files[0]?.hunks[0]?.lines.map((line) => line.kind)).toEqual([
      'removal',
      'metadata',
      'addition',
      'metadata',
    ]);

    const { container } = render(SourceDiffViewer, {
      patch: `diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-old();
\\ No newline at end of file
+new();
\\ No newline at end of file
`,
    });

    expect(container.textContent).toContain('No newline at end of file');
    expect(container.querySelector('.cinder-source-diff-viewer__metadata')).toBeNull();
  });

  test('bounds metadata-only patch rendering', () => {
    const parsed = parseUnifiedPatch(
      `diff --git a/assets/icon.png b/assets/icon.png
GIT binary patch
literal 2
abc
def
`,
      {
        maxLines: 2,
      },
    );

    expect(parsed.totalLineCount).toBe(4);
    expect(parsed.renderedLineCount).toBe(2);
    expect(parsed.truncated).toBe(true);
    expect(parsed.files[0]?.metadata).toEqual(['GIT binary patch', 'literal 2']);
  });

  test('starts diff -ru separators with the following file section', () => {
    const parsed = parseUnifiedPatch(`diff -ru old/one.txt new/one.txt
--- old/one.txt
+++ new/one.txt
@@ -1 +1 @@
-one
+one updated
diff -ru old/two.txt new/two.txt
--- old/two.txt
+++ new/two.txt
@@ -1 +1 @@
-two
+two updated
`);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.header).toBe('diff -ru old/one.txt new/one.txt');
    expect(parsed.files[1]?.header).toBe('diff -ru old/two.txt new/two.txt');
    expect(parsed.files[0]?.hunks[0]?.lines.map((line) => line.content)).not.toContain(
      'diff -ru old/two.txt new/two.txt',
    );
  });

  test('starts recursive-only diff entries outside completed hunks', () => {
    const parsed = parseUnifiedPatch(`diff -ru old/one.txt new/one.txt
--- old/one.txt
+++ new/one.txt
@@ -1 +1 @@
-one
+one updated
Only in new: extra.txt
`);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[1]?.header).toBe('Only in new: extra.txt');
    expect(parsed.files[1]?.metadata).toEqual(['Only in new: extra.txt']);
    expect(parsed.files[0]?.hunks[0]?.lines.map((line) => line.content)).not.toContain(
      'Only in new: extra.txt',
    );
  });

  test('starts leading recursive-only diff entries as their own files', () => {
    const parsed = parseUnifiedPatch(`Only in new: extra.txt
Binary files old/a and new/a differ
`);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.header).toBe('Only in new: extra.txt');
    expect(parsed.files[0]?.metadata).toEqual(['Only in new: extra.txt']);
    expect(getSourceDiffFileLabel(parsed.files[0]!)).toBe('Only in new: extra.txt');
    expect(parsed.files[1]?.header).toBe('Binary files old/a and new/a differ');
    expect(parsed.files[1]?.metadata).toEqual(['Binary files old/a and new/a differ']);
    expect(getSourceDiffFileLabel(parsed.files[1]!)).toBe('Binary files old/a and new/a differ');
  });

  test('starts binary recursive diff entries outside completed hunks', () => {
    const parsed = parseUnifiedPatch(`diff -ru old/one.txt new/one.txt
--- old/one.txt
+++ new/one.txt
@@ -1 +1 @@
-one
+one updated
Binary files old/two.bin and new/two.bin differ
`);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[1]?.header).toBe('Binary files old/two.bin and new/two.bin differ');
    expect(parsed.files[1]?.metadata).toEqual(['Binary files old/two.bin and new/two.bin differ']);
    expect(parsed.files[0]?.hunks[0]?.lines.map((line) => line.content)).not.toContain(
      'Binary files old/two.bin and new/two.bin differ',
    );
  });

  test('does not render hunk metadata for rows omitted by truncation', () => {
    const { container } = render(SourceDiffViewer, {
      patch: `--- src/example.ts
+++ src/example.ts
@@ -1 +1 @@
-old();
\\ No newline at end of file
+new();
\\ No newline at end of file
`,
      maxLines: 1,
    });

    const renderedRows = [
      ...container.querySelectorAll('.cinder-source-diff-viewer__line-code'),
    ].map((element) => element.textContent);
    expect(renderedRows).toEqual(['-old();']);
  });

  test('counts preserved hunk metadata against maxLines', () => {
    const parsed = parseUnifiedPatch(
      `--- src/example.ts
+++ src/example.ts
@@ -1 +1 @@
-old();
! metadata one
! metadata two
`,
      { maxLines: 1 },
    );

    expect(parsed.totalLineCount).toBe(3);
    expect(parsed.renderedLineCount).toBe(1);
    expect(parsed.truncated).toBe(true);
    expect(parsed.files[0]?.hunks[0]?.lines.map((line) => line.content)).toEqual(['old();']);
  });

  test('parses zero-count hunk headers', () => {
    const parsed = parseUnifiedPatch(`diff --git a/src/removed.ts b/src/removed.ts
--- a/src/removed.ts
+++ /dev/null
@@ -1 +0,0 @@
-removed();
`);

    const hunk = parsed.files[0]?.hunks[0];
    expect(hunk).toMatchObject({
      oldStart: 1,
      oldCount: 1,
      newStart: 0,
      newCount: 0,
    });
    expect(hunk?.lines[0]).toMatchObject({
      oldLineNumber: 1,
      newLineNumber: null,
      content: 'removed();',
    });
  });

  test('renders repeated file headers without duplicate keyed blocks', () => {
    const { container } = render(SourceDiffViewer, {
      patch: `diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-one();
+two();
diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-three();
+four();
`,
    });

    expect(container.querySelectorAll('.cinder-source-diff-viewer__file')).toHaveLength(2);
  });

  test('renders diff row prefixes adjacent to source text', () => {
    const { container } = render(SourceDiffViewer, {
      patch: `diff --git a/src/example.ts b/src/example.ts
--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-old();
+new();
`,
    });

    const renderedRows = [
      ...container.querySelectorAll('.cinder-source-diff-viewer__line-code'),
    ].map((element) => element.textContent);
    expect(renderedRows).toContain('-old();');
    expect(renderedRows).toContain('+new();');
  });

  test('treats /dev/null as a missing side of added and removed files', () => {
    const added = parseUnifiedPatch(`diff --git a/src/added.ts b/src/added.ts
--- /dev/null
+++ b/src/added.ts
@@ -0,0 +1 @@
+added();
`);
    const removed = parseUnifiedPatch(`diff --git a/src/removed.ts b/src/removed.ts
--- a/src/removed.ts
+++ /dev/null
@@ -1 +0,0 @@
-removed();
`);

    expect(added.files[0]?.oldPath).toBeNull();
    expect(getSourceDiffFileLabel(added.files[0]!)).toBe('src/added.ts');
    expect(removed.files[0]?.newPath).toBeNull();
    expect(getSourceDiffFileLabel(removed.files[0]!)).toBe('src/removed.ts');
  });

  test('ignores only the terminal split line from trailing newlines', () => {
    const parsed = parseUnifiedPatch(`--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-old();
+new();
`);

    expect(parsed.files[0]?.metadata).toEqual([]);
  });

  test('ignores repeated terminal split lines from trailing newlines', () => {
    const parsed = parseUnifiedPatch(`--- a/src/example.ts
+++ b/src/example.ts
@@ -1 +1 @@
-old();
+new();


`);

    expect(parsed.totalLineCount).toBe(2);
    expect(parsed.files[0]?.metadata).toEqual([]);
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

    expect(
      getSourceDiffLineLabel({
        kind: 'context',
        content: 'shifted();',
        oldLineNumber: 10,
        newLineNumber: 11,
      }),
    ).toBe('Context old line 10, new line 11: shifted();');
  });
});
