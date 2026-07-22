import { describe, expect, it } from 'bun:test';
import { computeLineDiff, computeWordChanges, getDiffStats, groupIntoHunks } from './line-diff';

describe('computeLineDiff', () => {
  describe('identical content', () => {
    it('returns all lines as same when content is identical', () => {
      const text = 'line 1\nline 2\nline 3';
      const result = computeLineDiff(text, text);

      expect(result).toEqual([
        { type: 'same', text: 'line 1' },
        { type: 'same', text: 'line 2' },
        { type: 'same', text: 'line 3' },
      ]);
    });

    it('handles empty content', () => {
      const result = computeLineDiff('', '');
      expect(result).toEqual([{ type: 'same', text: '' }]);
    });

    it('handles trailing newlines the same as the normal path', () => {
      const result = computeLineDiff('line 1\n', 'line 1\n');
      expect(result).toEqual([{ type: 'same', text: 'line 1' }]);
    });
  });

  describe('single character changes', () => {
    it('detects single character addition at end of word', () => {
      const original = '1. Clone the repository';
      const current = '1. Clone the repositoryee';
      const result = computeLineDiff(original, current);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('modified');
      if (result[0].type === 'modified') {
        expect(result[0].oldText).toBe('1. Clone the repository');
        expect(result[0].newText).toBe('1. Clone the repositoryee');
      }
    });

    it('detects single character change in middle of document', () => {
      const original = `# Title

First paragraph.

Second paragraph.`;
      const current = `# Title

First paragraphX.

Second paragraph.`;
      const result = computeLineDiff(original, current);

      // Should only have one modified line
      const modified = result.filter((r) => r.type === 'modified');
      expect(modified).toHaveLength(1);

      // All other lines should be same
      const same = result.filter((r) => r.type === 'same');
      expect(same.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('line additions', () => {
    it('detects new line at end', () => {
      const original = 'line 1\nline 2';
      const current = 'line 1\nline 2\nline 3';
      const result = computeLineDiff(original, current);

      expect(result).toContainEqual({ type: 'same', text: 'line 1' });
      expect(result).toContainEqual({ type: 'same', text: 'line 2' });
      expect(result).toContainEqual({ type: 'added', text: 'line 3' });
    });

    it('detects new line in middle', () => {
      const original = 'line 1\nline 3';
      const current = 'line 1\nline 2\nline 3';
      const result = computeLineDiff(original, current);

      expect(result).toContainEqual({ type: 'same', text: 'line 1' });
      expect(result).toContainEqual({ type: 'added', text: 'line 2' });
      expect(result).toContainEqual({ type: 'same', text: 'line 3' });
    });
  });

  describe('line deletions', () => {
    it('detects removed line at end', () => {
      const original = 'line 1\nline 2\nline 3';
      const current = 'line 1\nline 2';
      const result = computeLineDiff(original, current);

      expect(result).toContainEqual({ type: 'same', text: 'line 1' });
      expect(result).toContainEqual({ type: 'same', text: 'line 2' });
      expect(result).toContainEqual({ type: 'removed', text: 'line 3' });
    });

    it('detects removed line in middle', () => {
      const original = 'line 1\nline 2\nline 3';
      const current = 'line 1\nline 3';
      const result = computeLineDiff(original, current);

      expect(result).toContainEqual({ type: 'same', text: 'line 1' });
      expect(result).toContainEqual({ type: 'removed', text: 'line 2' });
      expect(result).toContainEqual({ type: 'same', text: 'line 3' });
    });
  });

  describe('markdown list handling', () => {
    it('correctly handles single word change in list item', () => {
      const original = `- Item one
- Item two
- Item three`;
      const current = `- Item one
- Item TWO
- Item three`;
      const result = computeLineDiff(original, current);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'same', text: '- Item one' });
      expect(result[1].type).toBe('modified');
      expect(result[2]).toEqual({ type: 'same', text: '- Item three' });
    });

    it('handles list with single character typo fix', () => {
      const original = `1. Clone the repository
2. Install dependencies
3. Start the server`;
      const current = `1. Clone the repositoryee
2. Install dependencies
3. Start the server`;
      const result = computeLineDiff(original, current);

      // Only first line should be modified
      const modified = result.filter((r) => r.type === 'modified');
      expect(modified).toHaveLength(1);

      // Other lines unchanged
      expect(result).toContainEqual({ type: 'same', text: '2. Install dependencies' });
      expect(result).toContainEqual({ type: 'same', text: '3. Start the server' });
    });
  });

  describe('complex markdown document', () => {
    const original = `# Project Overview

This document describes the architecture of our application.

## Components

The application is built with the following components:

- **Frontend**: SvelteKit with Svelte 5
- **Backend**: Node.js with tRPC
- **Database**: PostgreSQL with Drizzle ORM

## Getting Started

1. Clone the repository
2. Install dependencies with \`npm install\`
3. Start the development server

## Notes

The application uses server-side rendering for optimal performance.`;

    it('detects single word change without affecting other lines', () => {
      const current = original.replace('repository', 'repositoryee');
      const result = computeLineDiff(original, current);

      // Count changes
      const stats = getDiffStats(result);
      expect(stats.modified).toBe(1);
      expect(stats.added).toBe(0);
      expect(stats.removed).toBe(0);

      // Verify the modified line
      const modified = result.find((r) => r.type === 'modified');
      expect(modified).toBeDefined();
      if (modified?.type === 'modified') {
        expect(modified.oldText).toContain('repository');
        expect(modified.newText).toContain('repositoryee');
      }
    });

    it('detects heading change without affecting body', () => {
      const current = original.replace('# Project Overview', '# Project Summary');
      const result = computeLineDiff(original, current);

      const stats = getDiffStats(result);
      expect(stats.modified).toBe(1);
      expect(stats.added).toBe(0);
      expect(stats.removed).toBe(0);
    });
  });
});

describe('computeWordChanges', () => {
  it('identifies added text', () => {
    const result = computeWordChanges('hello', 'hello world');
    expect(result).toContainEqual({ type: 'same', text: 'hello' });
    expect(result).toContainEqual({ type: 'added', text: ' world' });
  });

  it('identifies removed text', () => {
    const result = computeWordChanges('hello world', 'hello');
    expect(result).toContainEqual({ type: 'same', text: 'hello' });
    expect(result).toContainEqual({ type: 'removed', text: ' world' });
  });

  it('identifies replaced text', () => {
    const result = computeWordChanges('hello world', 'hello universe');
    expect(result).toContainEqual({ type: 'same', text: 'hello ' });
    expect(result).toContainEqual({ type: 'removed', text: 'world' });
    expect(result).toContainEqual({ type: 'added', text: 'universe' });
  });
});

describe('getDiffStats', () => {
  it('counts changes correctly', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'added' as const, text: 'line 2' },
      { type: 'removed' as const, text: 'line 3' },
      { type: 'modified' as const, oldText: 'old', newText: 'new', wordChanges: [] },
      { type: 'same' as const, text: 'line 5' },
    ];

    const stats = getDiffStats(lineDiffs);
    expect(stats).toEqual({ added: 1, removed: 1, modified: 1 });
  });

  it('returns zeros for empty array', () => {
    const stats = getDiffStats([]);
    expect(stats).toEqual({ added: 0, removed: 0, modified: 0 });
  });

  it('returns zeros when all lines are same', () => {
    const lineDiffs = [
      { type: 'same' as const, text: 'line 1' },
      { type: 'same' as const, text: 'line 2' },
    ];
    const stats = getDiffStats(lineDiffs);
    expect(stats).toEqual({ added: 0, removed: 0, modified: 0 });
  });
});

describe('edge cases', () => {
  describe('empty and whitespace strings', () => {
    it('handles empty strings for both inputs', () => {
      const result = computeLineDiff('', '');
      expect(result).toEqual([{ type: 'same', text: '' }]);
    });

    it('handles empty original with non-empty current', () => {
      const result = computeLineDiff('', 'new line');
      expect(result).toEqual([{ type: 'added', text: 'new line' }]);
    });

    it('handles non-empty original with empty current', () => {
      const result = computeLineDiff('old line', '');
      expect(result).toEqual([{ type: 'removed', text: 'old line' }]);
    });

    it('handles whitespace-only original', () => {
      const result = computeLineDiff('   ', 'text');
      // The whitespace line is removed, text line is added
      expect(result.some((d) => d.type === 'removed' || d.type === 'modified')).toBe(true);
      expect(result.some((d) => d.type === 'added' || d.type === 'modified')).toBe(true);
    });

    it('handles whitespace-only current', () => {
      const result = computeLineDiff('text', '   ');
      expect(result.some((d) => d.type === 'removed' || d.type === 'modified')).toBe(true);
      expect(result.some((d) => d.type === 'added' || d.type === 'modified')).toBe(true);
    });

    it('handles both strings as whitespace-only', () => {
      const result = computeLineDiff('  ', '    ');
      // Different whitespace should show as modified
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('trailing newlines', () => {
    it('handles original with trailing newline, current without', () => {
      const result = computeLineDiff('line 1\nline 2\n', 'line 1\nline 2');
      // Should be treated as identical or nearly identical
      const stats = getDiffStats(result);
      expect(stats.added + stats.removed + stats.modified).toBeLessThanOrEqual(1);
    });

    it('handles original without trailing newline, current with', () => {
      const result = computeLineDiff('line 1\nline 2', 'line 1\nline 2\n');
      const stats = getDiffStats(result);
      expect(stats.added + stats.removed + stats.modified).toBeLessThanOrEqual(1);
    });

    it('handles multiple trailing newlines', () => {
      const result = computeLineDiff('line 1\n\n\n', 'line 1\n');
      expect(result).toBeDefined();
    });
  });

  describe('only additions or only deletions', () => {
    it('handles document that is entirely new (all additions)', () => {
      const result = computeLineDiff('', 'line 1\nline 2\nline 3');
      const stats = getDiffStats(result);
      expect(stats.added).toBe(3);
      expect(stats.removed).toBe(0);
      expect(stats.modified).toBe(0);
    });

    it('handles document that is entirely removed (all deletions)', () => {
      const result = computeLineDiff('line 1\nline 2\nline 3', '');
      const stats = getDiffStats(result);
      expect(stats.removed).toBe(3);
      expect(stats.added).toBe(0);
      expect(stats.modified).toBe(0);
    });
  });
});

describe('nested markdown structures', () => {
  it('handles nested lists correctly', () => {
    const original = `- Item 1
  - Nested 1
  - Nested 2
- Item 2`;
    const current = `- Item 1
  - Nested 1
  - Nested 2 modified
- Item 2`;
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it('handles blockquotes with nested content', () => {
    const original = `> Quote line 1
> Quote line 2`;
    const current = `> Quote line 1
> Quote line 2 changed`;
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
  });

  it('handles code blocks with language specifiers', () => {
    const original = '```typescript\nconst x = 1;\n```';
    const current = '```typescript\nconst x = 2;\n```';
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
  });

  it('handles tables correctly', () => {
    const original = `| A | B |
|---|---|
| 1 | 2 |`;
    const current = `| A | B |
|---|---|
| 1 | 3 |`;
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
  });
});

describe('mixed content types', () => {
  it('handles heading followed by list followed by paragraph', () => {
    const original = `# Title

- Item 1
- Item 2

Some paragraph.`;
    const current = `# Title Modified

- Item 1
- Item 2

Some paragraph.`;
    const result = computeLineDiff(original, current);
    const stats = getDiffStats(result);
    expect(stats.modified).toBe(1);
  });

  it('handles inline code changes', () => {
    const original = 'Use `npm install` to install';
    const current = 'Use `bun install` to install';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });

  it('handles link changes', () => {
    const original = 'Check [docs](https://example.com)';
    const current = 'Check [documentation](https://example.com)';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });
});

describe('Unicode content', () => {
  it('handles emoji content correctly', () => {
    const original = '# Hello World';
    const current = '# Hello World 🌍';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });

  it('handles CJK characters', () => {
    const original = '# 你好世界';
    const current = '# 你好世界改变了';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });

  it('handles Arabic text (RTL)', () => {
    const original = 'مرحبا';
    const current = 'مرحبا بكم';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });

  it('handles mixed unicode and ASCII', () => {
    const original = 'Hello 你好 World';
    const current = 'Hello 你好世界 World';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
  });

  it('handles special unicode characters (mathematical symbols)', () => {
    const original = 'The formula: α + β = γ';
    const current = 'The formula: α + β = δ';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('modified');
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
    expect(result[0].type).toBe('modified');
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
    expect(hunks[0].index).toBe(0);
    // The hunk should include context lines around the change
    expect(hunks[0].lines.length).toBeGreaterThan(1);
    expect(hunks[0].currentLines).toContain('new line');
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
    expect(hunks[0].originalStart).toBe(1);
    expect(hunks[0].currentStart).toBe(1);
    expect(hunks[0].originalLines).toContain('old line');
    expect(hunks[0].currentLines).toContain('new line');
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
    expect(hunks[0].originalLines).toContain('old text');
    expect(hunks[0].currentLines).toContain('new text');
  });
});

describe('unequal line count alignment', () => {
  it('prefers exact matches over earlier near matches', () => {
    const result = computeLineDiff('Hello world\nA', 'Hello worlds\nHello world\nB');

    expect(result[0]).toEqual({ type: 'added', text: 'Hello worlds' });
    expect(result[1]).toEqual({ type: 'same', text: 'Hello world' });
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
