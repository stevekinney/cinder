import { describe, expect, it } from 'bun:test';
import { computeLineDiff, computeWordChanges, getDiffStats, groupIntoHunks } from './line-diff';

describe('Unicode content', () => {
  it('handles emoji content correctly', () => {
    const original = '# Hello World';
    const current = '# Hello World 🌍';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });

  it('handles CJK characters', () => {
    const original = '# 你好世界';
    const current = '# 你好世界改变了';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });

  it('handles Arabic text (RTL)', () => {
    const original = 'مرحبا';
    const current = 'مرحبا بكم';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });

  it('handles mixed unicode and ASCII', () => {
    const original = 'Hello 你好 World';
    const current = 'Hello 你好世界 World';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });

  it('handles special unicode characters (mathematical symbols)', () => {
    const original = 'The formula: α + β = γ';
    const current = 'The formula: α + β = δ';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });
});

describe('long documents', () => {
  it('handles documents with many lines', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const original = lines.join('\n');
    const current = lines.map((l, i) => (i === 50 ? 'Modified line 51' : l)).join('\n');

    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);

    expect(stats.modified).toBe(1);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it('handles very long lines', () => {
    const longLine = 'a'.repeat(10000);
    const original = longLine;
    const current = longLine + 'b';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });

  it('handles documents with mixed long and short lines', () => {
    const original = 'short\n' + 'x'.repeat(5000) + '\nshort';
    const current = 'short\n' + 'y'.repeat(5000) + '\nshort';
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
  });
});

describe('alignment algorithm', () => {
  it('correctly pairs similar lines when lines are inserted', () => {
    const original = `# Title
First paragraph
Last paragraph`;
    const current = `# Title
First paragraph
Middle paragraph
Last paragraph`;

    const result = computeLineDiff(original, current);

    // "Last paragraph" should remain as same, "Middle paragraph" should be added
    expect(result).toContainEqual({ type: 'same', text: '# Title' });
    expect(result).toContainEqual({ type: 'same', text: 'First paragraph' });
    expect(result).toContainEqual({ type: 'added', text: 'Middle paragraph' });
    expect(result).toContainEqual({ type: 'same', text: 'Last paragraph' });
  });

  it('correctly pairs similar lines when lines are removed', () => {
    const original = `# Title
First paragraph
Middle paragraph
Last paragraph`;
    const current = `# Title
First paragraph
Last paragraph`;

    const result = computeLineDiff(original, current);

    expect(result).toContainEqual({ type: 'same', text: '# Title' });
    expect(result).toContainEqual({ type: 'same', text: 'First paragraph' });
    expect(result).toContainEqual({ type: 'removed', text: 'Middle paragraph' });
    expect(result).toContainEqual({ type: 'same', text: 'Last paragraph' });
  });

  it('handles complete replacement of content', () => {
    const original = `Old content
More old content
Final old content`;
    const current = `New content
More new content
Final new content`;

    const result = computeLineDiff(original, current);
    // All lines should be either modified, or removed+added pairs
    const stats = getDiffStats(result);
    expect(stats.modified + stats.removed + stats.added).toBeGreaterThan(0);
  });

  it('handles interleaved additions and deletions', () => {
    const original = 'A\nB\nC\nD';
    const current = 'A\nX\nC\nY';

    const result = computeLineDiff(original, current);

    expect(result).toContainEqual({ type: 'same', text: 'A' });
    expect(result).toContainEqual({ type: 'same', text: 'C' });
    // B and D should be removed or modified to X and Y
  });
});

describe('computeWordChanges edge cases', () => {
  it('handles empty strings', () => {
    const result = computeWordChanges('', '');
    expect(result).toEqual([]);
  });

  it('handles empty to non-empty', () => {
    const result = computeWordChanges('', 'hello');
    expect(result).toEqual([{ type: 'added', text: 'hello' }]);
  });

  it('handles non-empty to empty', () => {
    const result = computeWordChanges('hello', '');
    expect(result).toEqual([{ type: 'removed', text: 'hello' }]);
  });

  it('handles identical strings', () => {
    const result = computeWordChanges('hello', 'hello');
    expect(result).toEqual([{ type: 'same', text: 'hello' }]);
  });

  it('handles single character change', () => {
    const result = computeWordChanges('hello', 'hallo');
    // Should have some combination showing the change
    expect(result.some((c) => c.type === 'removed')).toBe(true);
    expect(result.some((c) => c.type === 'added')).toBe(true);
  });

  it('handles whitespace changes', () => {
    const result = computeWordChanges('hello world', 'hello  world');
    // Should detect the extra space
    expect(result.length).toBeGreaterThan(1);
  });
});

describe('groupIntoHunks', () => {
  it('returns empty array when there are no changes', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'same' as const, text: 'line 2' },
    ];
    const hunks = groupIntoHunks(lineDiffs);
    expect(hunks).toEqual([]);
  });

  it('creates a single hunk for a single change', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'same' as const, text: 'line 2' },
      { type: 'same' as const, text: 'line 3' },
      { type: 'same' as const, text: 'line 4' },
      { type: 'added' as const, text: 'new line' },
      { type: 'same' as const, text: 'line 5' },
      { type: 'same' as const, text: 'line 6' },
      { type: 'same' as const, text: 'line 7' },
      { type: 'same' as const, text: 'line 8' },
    ];
    const hunks = groupIntoHunks(lineDiffs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.index).toBe(0);
    // The hunk should include context lines around the change
    expect(hunks[0]!.lines.length).toBeGreaterThan(1);
    expect(hunks[0]!.currentLines).toContain('new line');
  });

  it('merges nearby changes into a single hunk', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'added' as const, text: 'new A' },
      { type: 'same' as const, text: 'line 2' },
      { type: 'same' as const, text: 'line 3' },
      { type: 'removed' as const, text: 'old B' },
      { type: 'same' as const, text: 'line 4' },
    ];
    const hunks = groupIntoHunks(lineDiffs);
    // Changes are close enough (within 2*3=6 lines) to merge
    expect(hunks).toHaveLength(1);
  });

  it('creates separate hunks for distant changes', () => {
    const lines: Array<{ type: 'same'; text: string } | { type: 'added'; text: string }> = [];
    lines.push({ type: 'added', text: 'new at start' });
    for (let i = 0; i < 20; i++) {
      lines.push({ type: 'same', text: `line ${i}` });
    }
    lines.push({ type: 'added', text: 'new at end' });

    const hunks = groupIntoHunks(lines);
    expect(hunks.length).toBeGreaterThanOrEqual(2);
  });

  it('tracks original and current line numbers', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'removed' as const, text: 'old line' },
      { type: 'added' as const, text: 'new line' },
      { type: 'same' as const, text: 'line 3' },
    ];
    const hunks = groupIntoHunks(lineDiffs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.originalStart).toBe(1);
    expect(hunks[0]!.currentStart).toBe(1);
    expect(hunks[0]!.originalLines).toContain('old line');
    expect(hunks[0]!.currentLines).toContain('new line');
  });

  it('handles modified lines in hunks', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      {
        type: 'modified' as const,
        oldText: 'old text',
        newText: 'new text',
        wordChanges: [
          { type: 'removed' as const, text: 'old' },
          { type: 'added' as const, text: 'new' },
          { type: 'same' as const, text: ' text' },
        ],
      },
      { type: 'same' as const, text: 'line 3' },
    ];
    const hunks = groupIntoHunks(lineDiffs);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.originalLines).toContain('old text');
    expect(hunks[0]!.currentLines).toContain('new text');
  });
});

describe('unequal line count alignment', () => {
  it('prefers exact matches over earlier near matches', () => {
    const result = computeLineDiff('Hello world\nA', 'Hello worlds\nHello world\nB');

    expect(result[0]!).toEqual({ type: 'added', text: 'Hello worlds' });
    expect(result[1]!).toEqual({ type: 'same', text: 'Hello world' });
    expect(result).not.toContainEqual(
      expect.objectContaining({
        type: 'modified',
        oldText: 'Hello world',
        newText: 'Hello worlds',
      }),
    );
  });

  it('handles modification where lines are added', () => {
    const original = 'line A\nline B';
    const current = 'line A modified\ninserted line\nline B modified';
    const result = computeLineDiff(original, current);

    // Should detect changes without crashing
    const stats = getDiffStats(result);
    expect(stats.added + stats.removed + stats.modified).toBeGreaterThan(0);
  });

  it('handles modification where lines are removed', () => {
    const original = 'line A\nline B\nline C\nline D';
    const current = 'line A changed\nline D changed';
    const result = computeLineDiff(original, current);

    const stats = getDiffStats(result);
    expect(stats.added + stats.removed + stats.modified).toBeGreaterThan(0);
  });
});
