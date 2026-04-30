// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Tests for unified diff export functionality.
 */

import { describe, expect, test } from 'bun:test';
import type { ReviewState } from '../comments/types.js';
import { generateUnifiedDiff } from './unified-diff';

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
