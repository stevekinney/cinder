// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Tests for unified diff export functionality.
 */

import { computeLineDiff, groupIntoHunks } from '@lostgradient/markdown/diff/line-diff';
import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReviewState } from '../comments/types.js';
import {
  composeDisplayedDocument,
  formatComputedUnifiedDiff,
  generateUnifiedDiff,
} from './unified-diff';

/** Create a minimal ReviewState for testing */
function createState(original: string, current: string): ReviewState {
  return {
    schemaVersion: 4,
    content: current,
    original,
    threads: [],
    updatedAt: new Date().toISOString(),
  };
}

describe('generateUnifiedDiff', () => {
  describe('basic functionality', () => {
    test('returns empty diff when content is identical', () => {
      const state = createState('Hello world', 'Hello world');
      const result = generateUnifiedDiff(state);

      expect(result.diff).toBe('');
      expect(result.stats.additions).toBe(0);
      expect(result.stats.deletions).toBe(0);
      expect(result.stats.hunks).toBe(0);
    });

    test('generates diff for single line change', () => {
      const state = createState('Hello world', 'Hello universe');
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('--- a/document.md');
      expect(result.diff).toContain('+++ b/document.md');
      expect(result.diff).toContain('-Hello world');
      expect(result.diff).toContain('+Hello universe');
      expect(result.stats.additions).toBe(1);
      expect(result.stats.deletions).toBe(1);
      expect(result.stats.hunks).toBe(1);
    });

    test('generates diff for line insertion', () => {
      const original = 'Line 1\nLine 2';
      const current = 'Line 1\nNew Line\nLine 2';
      const state = createState(original, current);
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('+New Line');
      expect(result.stats.additions).toBe(1);
      expect(result.stats.deletions).toBe(0);
    });

    test('generates diff for line deletion', () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const current = 'Line 1\nLine 3';
      const state = createState(original, current);
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('-Line 2');
      expect(result.stats.additions).toBe(0);
      expect(result.stats.deletions).toBe(1);
    });
  });

  test('preserves formatting-only changes when normalization is disabled', () => {
    const result = generateUnifiedDiff(
      { schemaVersion: 1, original: '- item\n', content: '* item\n', threads: [], updatedAt: '' },
      { normalizeInputs: false },
    );
    expect(result.diff).toContain('-- item');
    expect(result.diff).toContain('+* item');
  });

  test('does not count a trailing newline as an extra diff line', () => {
    const result = generateUnifiedDiff(createState('a\n', 'b\n'), { normalizeInputs: false });

    expect(result.diff).toContain('@@ -1,1 +1,1 @@');
    expect(result.diff).not.toContain('@@ -1,2 +1,2 @@');
    expect(result.diff).not.toContain('\\ No newline at end of file');
  });

  test('represents a removed EOF newline with the standard marker', () => {
    const result = generateUnifiedDiff(createState('a\n', 'a'), { normalizeInputs: false });

    expect(result.diff).toContain('@@ -1,1 +1,1 @@');
    expect(result.diff).toContain('-a\n+a\n\\ No newline at end of file');
  });

  describe('hunk generation', () => {
    test('includes context lines', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const current = 'Line 1\nLine 2\nModified\nLine 4\nLine 5';
      const state = createState(original, current);
      const result = generateUnifiedDiff(state, { contextLines: 2 });

      // Should include 2 lines of context before and after
      expect(result.diff).toContain(' Line 1');
      expect(result.diff).toContain(' Line 2');
      expect(result.diff).toContain('-Line 3');
      expect(result.diff).toContain('+Modified');
      expect(result.diff).toContain(' Line 4');
      expect(result.diff).toContain(' Line 5');
    });

    test('merges overlapping hunks', () => {
      // Changes close enough together should be in a single hunk
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
      const original = lines.join('\n');
      const modified = [...lines];
      modified[2] = 'Changed 3';
      modified[5] = 'Changed 6';
      const current = modified.join('\n');

      const state = createState(original, current);
      const result = generateUnifiedDiff(state, { contextLines: 2 });

      // With context of 2, changes at lines 3 and 6 should merge into one hunk
      expect(result.stats.hunks).toBe(1);
    });

    test('creates separate hunks for distant changes', () => {
      // Changes far apart should be in separate hunks
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
      const original = lines.join('\n');
      const modified = [...lines];
      modified[1] = 'Changed 2';
      modified[18] = 'Changed 19';
      const current = modified.join('\n');

      const state = createState(original, current);
      const result = generateUnifiedDiff(state, { contextLines: 3 });

      // Changes at lines 2 and 19 should be in separate hunks
      expect(result.stats.hunks).toBe(2);
    });
  });

  describe('hunk headers', () => {
    test('generates correct hunk header format', () => {
      const state = createState('Line 1\nLine 2', 'Line 1\nModified');
      const result = generateUnifiedDiff(state);

      // Should match unified diff hunk header format: @@ -start,count +start,count @@
      expect(result.diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    });
  });

  describe('options', () => {
    test('uses custom file paths', () => {
      const state = createState('old', 'new');
      const result = generateUnifiedDiff(state, {
        originalPath: 'a/custom.md',
        currentPath: 'b/custom.md',
      });

      expect(result.diff).toContain('--- a/custom.md');
      expect(result.diff).toContain('+++ b/custom.md');
    });

    test('respects contextLines option', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
      const original = lines.join('\n');
      const modified = [...lines];
      modified[4] = 'Changed';
      const current = modified.join('\n');

      // With 0 context, should only show the change
      const state = createState(original, current);
      const result = generateUnifiedDiff(state, { contextLines: 0 });

      expect(result.diff).toContain('-Line 5');
      expect(result.diff).toContain('+Changed');
      // Should not include adjacent lines
      expect(result.diff).not.toContain(' Line 4');
      expect(result.diff).not.toContain(' Line 6');
    });
  });

  describe('edge cases', () => {
    test('handles empty original', () => {
      const state = createState('', 'New content');
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('+New content');
      expect(result.stats.additions).toBe(1);
      expect(result.stats.deletions).toBe(0);
    });

    test('generates correct hunk header for empty original (new file)', () => {
      const state = createState('', 'Line 1\nLine 2\nLine 3');
      const result = generateUnifiedDiff(state);

      // For new files, original should be @@ -0,0 +1,n @@
      expect(result.diff).toMatch(/@@ -0,0 \+1,3 @@/);
    });

    test('handles empty current', () => {
      const state = createState('Old content', '');
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('-Old content');
      expect(result.stats.additions).toBe(0);
      expect(result.stats.deletions).toBe(1);
    });

    test('generates correct hunk header for empty current (full deletion)', () => {
      const state = createState('Line 1\nLine 2\nLine 3', '');
      const result = generateUnifiedDiff(state);

      // For full deletion, current should be @@ -1,n +0,0 @@
      expect(result.diff).toMatch(/@@ -1,3 \+0,0 @@/);
    });

    test('handles missing original (undefined)', () => {
      const state: ReviewState = {
        schemaVersion: 4,
        content: 'New content',
        threads: [],
        updatedAt: new Date().toISOString(),
      };
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('+New content');
    });

    test('handles multiline content', () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const current = 'Line 1\nModified 2\nLine 3\nModified 4\nLine 5';
      const state = createState(original, current);
      const result = generateUnifiedDiff(state);

      expect(result.diff).toContain('-Line 2');
      expect(result.diff).toContain('+Modified 2');
      expect(result.diff).toContain('-Line 4');
      expect(result.diff).toContain('+Modified 4');
    });

    test('preserves trailing newlines in output', () => {
      const state = createState('Hello', 'World');
      const result = generateUnifiedDiff(state);

      // Unified diff should end with a newline
      expect(result.diff.endsWith('\n')).toBe(true);
    });
  });
});

describe('front matter', () => {
  /**
   * Apply a patch the way a consumer would, with git itself. A string comparison
   * would not catch the failure mode this guards: hunk headers whose line counts
   * disagree with the lines they introduce still *look* like a diff.
   */
  function gitApplyCheck(originalDocument: string, diff: string): { ok: boolean; error: string } {
    const directory = mkdtempSync(join(tmpdir(), 'unified-diff-'));

    // Setup is inside the try as well: a failing `git init` or write would
    // otherwise leak the directory it just created.
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: directory });
      writeFileSync(join(directory, 'document.md'), originalDocument);
      writeFileSync(join(directory, 'patch.diff'), diff);

      execFileSync('git', ['apply', '--check', 'patch.diff'], { cwd: directory, stdio: 'pipe' });
      return { ok: true, error: '' };
    } catch (error) {
      const stderr = (error as { stderr?: Buffer }).stderr;
      return { ok: false, error: stderr ? stderr.toString() : String(error) };
    } finally {
      // Each call makes a git repo under the OS temp dir; without this they
      // accumulate one per run, per CI shard.
      rmSync(directory, { recursive: true, force: true });
    }
  }

  const original = [
    '---',
    'title: Release Plan',
    'draft: true',
    'tags:',
    '  - launch',
    '  - q3',
    '---',
    '',
    '# Release Plan',
    '',
    '- Ship the thing',
    '- Tell people about it',
    '',
  ].join('\n');
  const current = original.replace('draft: true', 'draft: false');

  test('produces a patch git can actually apply to the original document', () => {
    const { diff } = generateUnifiedDiff(createState(original, current));

    const applied = gitApplyCheck(original, diff);
    expect(applied.error).toBe('');
    expect(applied.ok).toBe(true);
  });

  test('keeps the front matter block verbatim instead of re-reading it as Markdown', () => {
    const { diff } = generateUnifiedDiff(createState(original, current));

    // The signature of the bug: normalize() has no front-matter step, so it reads
    // the fences as a thematic break plus a setext heading and re-emits the
    // underline as a run of dashes as long as the text above it. Such a line
    // appears in neither input document.
    expect(diff).not.toMatch(/^[-+ ]-{4,}$/m);
    // Indented YAML sequence items survive as context rather than being rewritten
    // into flush-left list items separated by blank lines.
    expect(diff).toContain('   - launch');
    expect(diff).toContain('@@ -1,6 +1,6 @@');
    expect(diff).toContain('\n-draft: true\n+draft: false\n');
    expect(diff.split('\n').filter((line) => line.startsWith('@@'))).toHaveLength(1);
  });

  test('still normalizes the body underneath front matter', () => {
    const starred = original.replace(/^- /gm, '* ');

    // A list-marker-only change is exactly what normalization exists to swallow;
    // preserving front matter must not cost us that.
    expect(generateUnifiedDiff(createState(original, starred)).diff).toBe('');
  });

  test('reports body edits at line numbers that count the front matter', () => {
    const edited = original.replace('- Ship the thing', '- Ship the thing on time');
    const { diff } = generateUnifiedDiff(createState(original, edited));

    const applied = gitApplyCheck(original, diff);
    expect(applied.error).toBe('');
    expect(applied.ok).toBe(true);
    // Line 8 is the blank line after the closing fence: the seven front-matter
    // lines are counted, not swallowed or re-expanded.
    expect(diff).toContain('@@ -8,5 +8,5 @@');
  });
});

describe('DiffViewer unified diff formatting', () => {
  test('anchors newly-added front matter with unchanged body context', () => {
    const frontMatterDiffs = computeLineDiff('', '---\ntitle: Example\n---');
    const bodyDiffs = computeLineDiff('Body text\n', 'Body text\n');
    const diff = formatComputedUnifiedDiff(groupIntoHunks([...frontMatterDiffs, ...bodyDiffs]));

    expect(diff).toContain('@@ -1,1 +1,4 @@');
    expect(diff).toContain('+---\n+title: Example\n+---\n Body text');
  });

  test('composes the exact displayed document without canonicalizing markdown syntax', () => {
    const original = composeDisplayedDocument('', '_italic_\n', false);
    const current = composeDisplayedDocument('', '*italic*\n', false);
    const result = generateUnifiedDiff(
      {
        schemaVersion: 1,
        original,
        content: current,
        threads: [],
        updatedAt: '',
      },
      { normalizeInputs: false },
    );

    expect(result.diff).toContain('-_italic_');
    expect(result.diff).toContain('+*italic*');
  });

  test('preserves both EOF states for front-matter-only documents', () => {
    const frontMatter = '---\ntitle: Example\n---';

    expect(composeDisplayedDocument(frontMatter, '', false)).toBe('---\ntitle: Example\n---');
    expect(composeDisplayedDocument(frontMatter, '', true)).toBe('---\ntitle: Example\n---\n');
  });

  test('marks changed final lines that lack trailing newlines in computed hunks', () => {
    const original = 'First line\nOld final line';
    const current = 'First line\nNew final line';
    const hunks = groupIntoHunks(computeLineDiff(original, current));

    const diff = formatComputedUnifiedDiff(hunks, { original, current });

    expect(diff).toContain(
      '-Old final line\n\\ No newline at end of file\n+New final line\n\\ No newline at end of file',
    );
  });

  test('marks unchanged final context when both documents lack trailing newlines', () => {
    const original = 'Old first line\nShared final line';
    const current = 'New first line\nShared final line';
    const hunks = groupIntoHunks(computeLineDiff(original, current));

    const diff = formatComputedUnifiedDiff(hunks, { original, current });

    expect(diff).toContain(' Shared final line\n\\ No newline at end of file');
  });
});
