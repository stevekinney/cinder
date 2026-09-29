import { describe, expect, it } from 'bun:test';
import { computeLineDiff, computeWordChanges, getDiffStats } from './line-diff';

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
      expect(result[0]!.type).toBe('modified');
      if (result[0]!.type === 'modified') {
        expect(result[0]!.oldText).toBe('1. Clone the repository');
        expect(result[0]!.newText).toBe('1. Clone the repositoryee');
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
      expect(result[0]!).toEqual({ type: 'same', text: '- Item one' });
      expect(result[1]!.type).toBe('modified');
      expect(result[2]!).toEqual({ type: 'same', text: '- Item three' });
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
