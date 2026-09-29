import { describe, expect, test } from 'bun:test';

import { parseUnifiedPatch } from './source-diff-viewer.utilities.ts';

const twoFilePatch = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,2 +1,2 @@
-old one
+new one
 unchanged one
diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,2 +1,2 @@
-old two
+new two
 unchanged two
`;

const repeatedPathPatch = `diff --git a/src/shared.ts b/src/shared.ts
--- a/src/shared.ts
+++ b/src/shared.ts
@@ -1,1 +1,1 @@
-first occurrence
+first occurrence changed
diff --git a/src/shared.ts b/src/shared.ts
--- a/src/shared.ts
+++ b/src/shared.ts
@@ -1,1 +1,1 @@
-second occurrence
+second occurrence changed
`;

const twoHunkPatch = `diff --git a/src/multi.ts b/src/multi.ts
--- a/src/multi.ts
+++ b/src/multi.ts
@@ -1,1 +1,1 @@
-hunk zero old
+hunk zero new
@@ -10,1 +10,1 @@
-hunk one old
+hunk one new
`;

describe('SourceDiffViewer: file and hunk occurrences', () => {
  test('assigns zero-based fileOccurrence and hunkOccurrence in patch order', () => {
    const parsed = parseUnifiedPatch(twoFilePatch);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.fileOccurrence).toBe(0);
    expect(parsed.files[0]?.hunks[0]?.hunkOccurrence).toBe(0);
    expect(parsed.files[1]?.fileOccurrence).toBe(1);
    expect(parsed.files[1]?.hunks[0]?.hunkOccurrence).toBe(0);
  });

  test('assigns distinct fileOccurrence to repeated paths across separate file entries', () => {
    const parsed = parseUnifiedPatch(repeatedPathPatch);

    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0]?.oldPath).toBe('src/shared.ts');
    expect(parsed.files[1]?.oldPath).toBe('src/shared.ts');
    expect(parsed.files[0]?.fileOccurrence).toBe(0);
    expect(parsed.files[1]?.fileOccurrence).toBe(1);
  });

  test('assigns hunkOccurrence per file in ascending patch order for multiple hunks', () => {
    const parsed = parseUnifiedPatch(twoHunkPatch);

    expect(parsed.files[0]?.hunks).toHaveLength(2);
    expect(parsed.files[0]?.hunks[0]?.hunkOccurrence).toBe(0);
    expect(parsed.files[0]?.hunks[1]?.hunkOccurrence).toBe(1);
  });

  test('keeps fileOccurrence and hunkOccurrence stable across different maxLines caps', () => {
    // A standalone recursive-diff-metadata entry ("Only in ...") is only ever
    // started as a file when it survives the render cap in today's parser.
    // Occurrence numbers must not shift when the cap changes which entries
    // are rendered — they identify patch position, not render position.
    const patchWithStandaloneEntry = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,1 +1,1 @@
-old one
+new one
Only in dir: untracked-file.txt
diff --git a/src/two.ts b/src/two.ts
--- a/src/two.ts
+++ b/src/two.ts
@@ -1,1 +1,1 @@
-old two
+new two
`;

    const full = parseUnifiedPatch(patchWithStandaloneEntry, { maxLines: 1000 });
    // A cap of 1 renders only the first hunk's first row, well before the
    // "Only in" entry or the second file's hunk would ever be reached.
    const capped = parseUnifiedPatch(patchWithStandaloneEntry, { maxLines: 1 });

    expect(full.descriptors).toHaveLength(3);
    expect(capped.descriptors).toHaveLength(3);

    for (const descriptor of full.descriptors) {
      const cappedDescriptor = capped.descriptors.find(
        (candidate) => candidate.fileOccurrence === descriptor.fileOccurrence,
      );
      expect(cappedDescriptor).toBeDefined();
      expect(cappedDescriptor?.oldPath).toBe(descriptor.oldPath);
      expect(cappedDescriptor?.newPath).toBe(descriptor.newPath);
    }

    // The "Only in" entry (second recognized file) never renders under a cap
    // this low, so it must be reported as fully truncated rather than absent.
    const onlyInDescriptor = capped.descriptors.find((d) => d.fileOccurrence === 1);
    expect(onlyInDescriptor?.fullyTruncated).toBe(true);

    // The third file's hunk is preserved at its full-parse occurrence even
    // though none of its rows render under the low cap.
    const thirdFileHunkOccurrence = full.files[2]?.hunks[0]?.hunkOccurrence;
    expect(thirdFileHunkOccurrence).toBe(0);
  });
});

describe('SourceDiffViewer: file descriptors', () => {
  test('describes every recognized file, including counts and paths', () => {
    const parsed = parseUnifiedPatch(twoFilePatch);

    expect(parsed.descriptors).toHaveLength(2);
    expect(parsed.descriptors[0]).toMatchObject({
      fileOccurrence: 0,
      oldPath: 'src/one.ts',
      newPath: 'src/one.ts',
      hunkCount: 1,
      changedLineCount: 2,
      fullyTruncated: false,
    });
    expect(parsed.descriptors[1]).toMatchObject({
      fileOccurrence: 1,
      oldPath: 'src/two.ts',
      newPath: 'src/two.ts',
      hunkCount: 1,
      changedLineCount: 2,
      fullyTruncated: false,
    });
  });

  test('includes a descriptor for a fully truncated file that is dropped from files[]', () => {
    // maxLines: 0 renders no diff rows for any file. Every file is pruned from
    // `files`, but each must still produce a descriptor.
    const parsed = parseUnifiedPatch(twoFilePatch, { maxLines: 0 });

    expect(parsed.files).toHaveLength(0);
    expect(parsed.descriptors).toHaveLength(2);
    expect(parsed.descriptors[0]?.fullyTruncated).toBe(true);
    expect(parsed.descriptors[1]?.fullyTruncated).toBe(true);
    expect(parsed.descriptors[0]?.changedLineCount).toBe(2);
  });

  test('descriptor label matches the existing file-label convention', () => {
    const parsed = parseUnifiedPatch(twoFilePatch);

    expect(parsed.descriptors[0]?.label).toBe('src/one.ts');
  });

  test('assigns a stable descriptor even for a file with no hunks (metadata only)', () => {
    const binaryPatch = `diff --git a/image.png b/image.png
index 1111111..2222222 100644
Binary files a/image.png and b/image.png differ
`;
    const parsed = parseUnifiedPatch(binaryPatch);

    expect(parsed.descriptors).toHaveLength(1);
    expect(parsed.descriptors[0]?.hunkCount).toBe(0);
    expect(parsed.descriptors[0]?.changedLineCount).toBe(0);
    expect(parsed.descriptors[0]?.fullyTruncated).toBe(false);
  });
});
