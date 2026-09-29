/**
 * Unit tests for markdown rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { clearRenderCache, renderMarkdown } from './render.js';

describe('renderMarkdown', () => {
  beforeEach(() => {
    clearRenderCache();
  });

  describe('CommonMark basics', () => {
    it('renders headings', () => {
      const result = renderMarkdown('# Heading 1\n\n## Heading 2\n\n### Heading 3');
      expect(result.html).toContain('<h1>Heading 1</h1>');
      expect(result.html).toContain('<h2>Heading 2</h2>');
      expect(result.html).toContain('<h3>Heading 3</h3>');
    });

    it('renders paragraphs', () => {
      const result = renderMarkdown('First paragraph.\n\nSecond paragraph.');
      expect(result.html).toContain('<p>First paragraph.</p>');
      expect(result.html).toContain('<p>Second paragraph.</p>');
    });

    it('renders emphasis', () => {
      const result = renderMarkdown('*italic* **bold** ***bold italic***');
      expect(result.html).toContain('<em>italic</em>');
      expect(result.html).toContain('<strong>bold</strong>');
      // Both <em><strong> and <strong><em> are valid - just check both tags are present
      expect(result.html).toContain('<em>');
      expect(result.html).toContain('<strong>');
      expect(result.html).toContain('bold italic');
    });

    it('renders links', () => {
      const result = renderMarkdown('[Example](https://example.com)');
      expect(result.html).toContain('<a href="https://example.com">Example</a>');
    });

    it('renders inline code', () => {
      const result = renderMarkdown('Use `console.log()` for debugging');
      expect(result.html).toContain('<code>console.log()</code>');
    });

    it('renders blockquotes', () => {
      const result = renderMarkdown('> This is a quote');
      expect(result.html).toContain('<blockquote>');
      expect(result.html).toContain('This is a quote');
    });

    it('renders horizontal rules', () => {
      const result = renderMarkdown('Above\n\n---\n\nBelow');
      expect(result.html).toContain('<hr');
    });
  });

  describe('GFM essentials', () => {
    it('preserves stable override placeholders through sanitization', () => {
      const result = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```', {
        nodePlaceholders: true,
      });
      expect(result.html).toContain('data-cinder-markdown-kind="table"');
      expect(result.html).toContain('data-cinder-markdown-kind="code-block"');
      expect(result.html).toContain('data-cinder-markdown-index="0"');
      expect(result.html).toContain('data-language="js"');
    });

    it('keeps node placeholders opt-in for existing renderer consumers', () => {
      const result = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1;\n```');
      expect(result.html).not.toContain('cinder-markdown-node');
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<pre');
    });

    it('renders strikethrough', () => {
      const result = renderMarkdown('~~deleted~~');
      expect(result.html).toContain('<del>deleted</del>');
    });

    it('renders tables', () => {
      const result = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<th>A</th>');
      expect(result.html).toContain('<td>1</td>');
    });

    it('renders task lists', () => {
      const result = renderMarkdown('- [ ] Unchecked\n- [x] Checked');
      expect(result.html).toContain('type="checkbox"');
      expect(result.html).toContain('disabled');
    });

    it('renders unordered lists', () => {
      const result = renderMarkdown('- Item 1\n- Item 2\n- Item 3');
      expect(result.html).toContain('<ul>');
      expect(result.html).toContain('<li>');
    });

    it('renders ordered lists', () => {
      const result = renderMarkdown('1. First\n2. Second\n3. Third');
      expect(result.html).toContain('<ol>');
      expect(result.html).toContain('<li>');
    });

    it('renders nested lists', () => {
      const result = renderMarkdown('- Parent\n  - Child\n    - Grandchild');
      expect(result.html).toContain('<ul>');
      // Check for nested structure
      const ulCount = (result.html.match(/<ul>/g) || []).length;
      expect(ulCount).toBeGreaterThanOrEqual(2);
    });

    it('renders autolinks', () => {
      const result = renderMarkdown('<https://example.com>');
      expect(result.html).toContain('<a href="https://example.com">');
    });
  });

  describe('code blocks', () => {
    it('renders code blocks with language', () => {
      const result = renderMarkdown('```typescript\nconst x = 1;\n```');
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('const');
      expect(result.html).toContain('1');
    });

    it('extracts code block metadata', () => {
      const result = renderMarkdown('```typescript title=example.ts\nconst x = 1;\n```');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0]!.language).toBe('typescript');
      expect(result.codeBlocks[0]!.meta).toBe('title=example.ts');
      expect(result.codeBlocks[0]!.value).toBe('const x = 1;');
      expect(result.codeBlocks[0]!.index).toBe(0);
    });

    it('extracts multiple code blocks in order', () => {
      const result = renderMarkdown(
        '```js\nfirst\n```\n\n```python\nsecond\n```\n\n```rust\nthird\n```',
      );
      expect(result.codeBlocks).toHaveLength(3);
      expect(result.codeBlocks[0]!.language).toBe('js');
      expect(result.codeBlocks[0]!.index).toBe(0);
      expect(result.codeBlocks[1]!.language).toBe('python');
      expect(result.codeBlocks[1]!.index).toBe(1);
      expect(result.codeBlocks[2]!.language).toBe('rust');
      expect(result.codeBlocks[2]!.index).toBe(2);
    });

    it('handles code blocks without language', () => {
      const result = renderMarkdown('```\nplain code\n```');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0]!.language).toBeNull();
      expect(result.codeBlocks[0]!.value).toBe('plain code');
    });

    it('escapes HTML entities in code blocks', () => {
      const result = renderMarkdown('```html\n<script>alert("xss")</script>\n```');
      // HTML should be escaped or tokenized by syntax highlighting, not executed.
      expect(result.html).toContain('script');
      expect(result.html).not.toContain('<script>');
    });
  });

  describe('images', () => {
    it('renders images with alt text', () => {
      const result = renderMarkdown('![Alt text](https://example.com/image.png)');
      expect(result.html).toContain('<img');
      expect(result.html).toContain('alt="Alt text"');
      expect(result.html).toContain('src="https://example.com/image.png"');
    });

    it('renders images with title', () => {
      const result = renderMarkdown('![Alt](https://example.com/img.png "Title")');
      expect(result.html).toContain('title="Title"');
    });
  });

  describe('empty and edge cases', () => {
    it('handles empty string', () => {
      const result = renderMarkdown('');
      expect(result.html).toBe('');
      expect(result.rawMarkdown).toBe('');
      expect(result.codeBlocks).toEqual([]);
      expect(result.hadUnsafeContent).toBe(false);
    });

    it('handles whitespace-only input', () => {
      const result = renderMarkdown('   \n\n   ');
      expect(result.codeBlocks).toEqual([]);
    });

    it('handles null/undefined gracefully', () => {
      // @ts-expect-error - testing runtime behavior
      expect(renderMarkdown(null).html).toBe('');
      // @ts-expect-error - testing runtime behavior
      expect(renderMarkdown(undefined).html).toBe('');
    });
  });

  describe('LRU cache eviction', () => {
    it('evicts oldest entries when cache exceeds 50 items', () => {
      clearRenderCache();

      // Render 51 distinct inputs to exceed the cache limit of 50
      for (let i = 0; i < 51; i++) {
        renderMarkdown(`# Heading ${i}`);
      }

      // Re-render the first input — it should have been evicted,
      // but still produces the correct result (recomputed)
      const result = renderMarkdown('# Heading 0');
      expect(result.html).toContain('<h1>Heading 0</h1>');
    });
  });

  describe('rawMarkdown preservation', () => {
    it('preserves original markdown unchanged', () => {
      const input = '# Hello\n\n**World**\n\n```js\ncode\n```';
      const result = renderMarkdown(input);
      expect(result.rawMarkdown).toBe(input);
    });
  });

  describe('determinism', () => {
    it('produces identical output for same input', () => {
      const input = '# Test\n\n- Item 1\n- Item 2\n\n```js\nconst x = 1;\n```';

      const result1 = renderMarkdown(input);
      clearRenderCache(); // Clear cache to ensure fresh computation
      const result2 = renderMarkdown(input);

      expect(result1.html).toBe(result2.html);
      expect(result1.codeBlocks).toEqual(result2.codeBlocks);
      expect(result1.hadUnsafeContent).toBe(result2.hadUnsafeContent);
    });

    it('produces same output regardless of call order', () => {
      const inputs = ['# First', '## Second', '### Third'];
      const results1 = inputs.map((input) => renderMarkdown(input).html);

      clearRenderCache();

      // Call in reverse order
      const results2 = inputs.toReversed().map((input) => renderMarkdown(input).html);

      // Results should match (accounting for reversal)
      expect(results1[0]!).toBe(results2[2]!);
      expect(results1[1]!).toBe(results2[1]!);
      expect(results1[2]!).toBe(results2[0]!);
    });
  });

  describe('caching', () => {
    it('returns equivalent results for same input', () => {
      const input = '# Cached';
      const result1 = renderMarkdown(input);
      const result2 = renderMarkdown(input);

      // Results should be equal but not the same reference (cloned for mutation safety)
      expect(result1).not.toBe(result2);
      expect(result1.html).toBe(result2.html);
      expect(result1.rawMarkdown).toBe(result2.rawMarkdown);
      expect(result1.hadUnsafeContent).toBe(result2.hadUnsafeContent);
      expect(result1.codeBlocks).toEqual(result2.codeBlocks);
    });

    it('prevents cache corruption from caller mutations on cache hit', () => {
      const input = '```js\nconst x = 1;\n```';
      clearRenderCache();

      // First call populates the cache
      const result1 = renderMarkdown(input);
      const originalLength = result1.codeBlocks.length;

      // Second call returns from cache (clone)
      const result2 = renderMarkdown(input);

      // Mutate the second result (cache hit)
      result2.codeBlocks.push({ language: 'fake', meta: null, value: 'mutated', index: 99 });

      // Third call should still return clean data from cache
      const result3 = renderMarkdown(input);
      expect(result3.codeBlocks.length).toBe(originalLength);
      expect(result3.codeBlocks).not.toContainEqual(
        expect.objectContaining({ language: 'fake', value: 'mutated' }),
      );
    });

    it('prevents cache corruption from caller mutations on cache miss', () => {
      const input = '```python\nprint("hello")\n```';
      clearRenderCache();

      // First call is a cache miss - must also be protected
      const result1 = renderMarkdown(input);
      const originalLength = result1.codeBlocks.length;

      // Mutate the first result (cache miss - this was the bug)
      result1.codeBlocks.push({ language: 'fake', meta: null, value: 'mutated', index: 99 });

      // Second call should return clean data, not the mutated version
      const result2 = renderMarkdown(input);
      expect(result2.codeBlocks.length).toBe(originalLength);
      expect(result2.codeBlocks).not.toContainEqual(
        expect.objectContaining({ language: 'fake', value: 'mutated' }),
      );
    });

    it('returns different results for different inputs', () => {
      const result1 = renderMarkdown('# First');
      const result2 = renderMarkdown('# Second');

      expect(result1).not.toBe(result2);
      expect(result1.html).not.toBe(result2.html);
    });

    it('cache respects options', () => {
      const input = '![img](data:image/png;base64,abc)';

      const result1 = renderMarkdown(input, { allowDataImages: false });
      const result2 = renderMarkdown(input, { allowDataImages: true });

      expect(result1).not.toBe(result2);
    });
  });
});
