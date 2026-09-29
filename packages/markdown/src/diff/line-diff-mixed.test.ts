import { describe, expect, it } from 'bun:test';
import { computeLineDiff, getDiffStats } from './line-diff';

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
    expect(result[0]!.type).toBe('modified');
  });

  it('handles link changes', () => {
    const original = 'Check [docs](https://example.com)';
    const current = 'Check [documentation](https://example.com)';
    const result = computeLineDiff(original, current);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe('modified');
  });
});
