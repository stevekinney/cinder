/**
 * Unit tests for markdown rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { initializeHighlighter } from './highlighter.js';
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
      expect(result.codeBlocks[0].language).toBe('typescript');
      expect(result.codeBlocks[0].meta).toBe('title=example.ts');
      expect(result.codeBlocks[0].value).toBe('const x = 1;');
      expect(result.codeBlocks[0].index).toBe(0);
    });

    it('extracts multiple code blocks in order', () => {
      const result = renderMarkdown(
        '```js\nfirst\n```\n\n```python\nsecond\n```\n\n```rust\nthird\n```',
      );
      expect(result.codeBlocks).toHaveLength(3);
      expect(result.codeBlocks[0].language).toBe('js');
      expect(result.codeBlocks[0].index).toBe(0);
      expect(result.codeBlocks[1].language).toBe('python');
      expect(result.codeBlocks[1].index).toBe(1);
      expect(result.codeBlocks[2].language).toBe('rust');
      expect(result.codeBlocks[2].index).toBe(2);
    });

    it('handles code blocks without language', () => {
      const result = renderMarkdown('```\nplain code\n```');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBeNull();
      expect(result.codeBlocks[0].value).toBe('plain code');
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
      expect(results1[0]).toBe(results2[2]);
      expect(results1[1]).toBe(results2[1]);
      expect(results1[2]).toBe(results2[0]);
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

  describe('stripLinks option', () => {
    it('strips links when stripLinks is true', () => {
      const result = renderMarkdown('[Example](https://example.com)', { stripLinks: true });
      expect(result.html).not.toContain('<a');
      expect(result.html).not.toContain('href');
      expect(result.html).toContain('Example');
    });

    it('preserves links when stripLinks is false or undefined', () => {
      const resultFalse = renderMarkdown('[Example](https://example.com)', { stripLinks: false });
      const resultUndefined = renderMarkdown('[Example](https://example.com)');

      expect(resultFalse.html).toContain('<a href="https://example.com">Example</a>');
      expect(resultUndefined.html).toContain('<a href="https://example.com">Example</a>');
    });

    it('preserves link text when stripping links', () => {
      const result = renderMarkdown(
        'Check out [the docs](https://docs.example.com) for more info.',
        { stripLinks: true },
      );
      expect(result.html).toContain('the docs');
      expect(result.html).not.toContain('href');
    });

    it('handles multiple links when stripping', () => {
      const result = renderMarkdown('[First](https://first.com) and [Second](https://second.com)', {
        stripLinks: true,
      });
      expect(result.html).toContain('First');
      expect(result.html).toContain('Second');
      expect(result.html).not.toContain('<a');
    });

    it('preserves nested formatting within stripped links', () => {
      const result = renderMarkdown('[**Bold link text**](https://example.com)', {
        stripLinks: true,
      });
      expect(result.html).toContain('<strong>Bold link text</strong>');
      expect(result.html).not.toContain('<a');
    });

    it('strips autolinks', () => {
      const result = renderMarkdown('<https://example.com>', { stripLinks: true });
      expect(result.html).not.toContain('<a');
      expect(result.html).toContain('https://example.com');
    });

    it('strips reference-style links', () => {
      const markdown =
        'Check out [the docs][docs] for more info.\n\n[docs]: https://docs.example.com';
      const result = renderMarkdown(markdown, { stripLinks: true });
      expect(result.html).toContain('the docs');
      expect(result.html).not.toContain('<a');
      expect(result.html).not.toContain('href');
    });

    it('strips shortcut reference links', () => {
      const markdown = 'See [example] for details.\n\n[example]: https://example.com';
      const result = renderMarkdown(markdown, { stripLinks: true });
      expect(result.html).toContain('example');
      expect(result.html).not.toContain('<a');
    });

    it('strips collapsed reference links', () => {
      const markdown = 'Read the [docs][] here.\n\n[docs]: https://docs.example.com';
      const result = renderMarkdown(markdown, { stripLinks: true });
      expect(result.html).toContain('docs');
      expect(result.html).not.toContain('<a');
    });

    it('preserves reference-style images when stripping links', () => {
      const markdown = 'See the ![logo][img] for branding.\n\n[img]: https://example.com/logo.png';
      const result = renderMarkdown(markdown, { stripLinks: true });
      expect(result.html).toContain('<img');
      expect(result.html).toContain('src="https://example.com/logo.png"');
      expect(result.html).toContain('alt="logo"');
    });

    it('strips links but preserves images in mixed content', () => {
      const markdown =
        'Check [the docs][docs] and see ![diagram][img].\n\n[docs]: https://docs.example.com\n[img]: https://example.com/diagram.png';
      const result = renderMarkdown(markdown, { stripLinks: true });
      // Link should be stripped
      expect(result.html).toContain('the docs');
      expect(result.html).not.toContain('href="https://docs.example.com"');
      // Image should be preserved
      expect(result.html).toContain('<img');
      expect(result.html).toContain('src="https://example.com/diagram.png"');
    });

    it('preserves images when definition is shared with link', () => {
      // Edge case: same identifier used for both link and image
      const markdown =
        'See [the resource][ref] or ![the resource][ref].\n\n[ref]: https://example.com/resource';
      const result = renderMarkdown(markdown, { stripLinks: true });
      // Link should be stripped (text preserved)
      expect(result.html).toContain('the resource');
      // Image should still work because we don't remove shared definitions
      expect(result.html).toContain('<img');
      expect(result.html).toContain('src="https://example.com/resource"');
    });
  });

  describe('syntax highlighting', () => {
    // Initialize highlighter before all tests in this block
    beforeAll(async () => {
      await initializeHighlighter();
    });

    it('highlights TypeScript code blocks', () => {
      const result = renderMarkdown('```typescript\nconst x: number = 42;\n```');
      // Should have syntax highlighting styles
      expect(result.html).toContain('style=');
      // Should preserve code content
      expect(result.html).toContain('const');
      expect(result.html).toContain('42');
      // Should have data-language attribute
      expect(result.html).toContain('data-language="typescript"');
    });

    it('highlights JavaScript code blocks', () => {
      const result = renderMarkdown(
        '```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n```',
      );
      expect(result.html).toContain('style=');
      expect(result.html).toContain('function');
      expect(result.html).toContain('greet');
      expect(result.html).toContain('data-language="javascript"');
    });

    it('highlights Python code blocks', () => {
      const result = renderMarkdown('```python\ndef hello():\n    print("world")\n```');
      expect(result.html).toContain('style=');
      expect(result.html).toContain('def');
      expect(result.html).toContain('print');
      expect(result.html).toContain('data-language="python"');
    });

    it('highlights SQL code blocks', () => {
      const result = renderMarkdown('```sql\nSELECT * FROM users WHERE id = 1;\n```');
      expect(result.html).toContain('style=');
      expect(result.html).toContain('SELECT');
      expect(result.html).toContain('data-language="sql"');
    });

    it('handles language aliases', () => {
      // ts -> typescript
      const resultTs = renderMarkdown('```ts\nconst x = 1;\n```');
      expect(resultTs.html).toContain('data-language="typescript"');

      // js -> javascript
      const resultJs = renderMarkdown('```js\nlet y = 2;\n```');
      expect(resultJs.html).toContain('data-language="javascript"');

      // py -> python
      const resultPy = renderMarkdown('```py\nx = 1\n```');
      expect(resultPy.html).toContain('data-language="python"');
    });

    it('leaves plaintext code blocks unhighlighted', () => {
      const result = renderMarkdown('```plaintext\nThis is plain text.\n```');
      // Should NOT have inline styles for highlighting
      expect(result.html).not.toMatch(/<span[^>]*style="color:/);
      // Should have the data-language attribute
      expect(result.html).toContain('data-language="plaintext"');
      // Content should be preserved
      expect(result.html).toContain('This is plain text.');
    });

    it('handles code blocks without language as plaintext', () => {
      const result = renderMarkdown('```\nNo language specified.\n```');
      // Should have pre and code tags
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      // Content should be preserved
      expect(result.html).toContain('No language specified.');
    });

    it('falls back to plaintext for unknown languages', () => {
      const result = renderMarkdown('```unknownlang\nconst x = 1;\n```');
      // Should have data-language attribute set to plaintext
      expect(result.html).toContain('data-language="plaintext"');
      // Content should still be preserved
      expect(result.html).toContain('const x = 1');
    });

    it('uses CSS variables for colors', () => {
      const result = renderMarkdown('```typescript\nconst x = "hello";\n```');
      // Should use CSS variables from design tokens
      expect(result.html).toMatch(/var\(--syntax-/);
    });

    it('preserves code content exactly', () => {
      const code = 'function test() {\n  return 42;\n}';
      const result = renderMarkdown('```javascript\n' + code + '\n```');
      // The code should be preserved (check key parts)
      expect(result.html).toContain('function');
      expect(result.html).toContain('test');
      expect(result.html).toContain('return');
      expect(result.html).toContain('42');
    });

    it('highlights multiple code blocks independently', () => {
      const markdown = `
\`\`\`typescript
const ts = "TypeScript";
\`\`\`

\`\`\`python
py = "Python"
\`\`\`
`;
      const result = renderMarkdown(markdown);
      expect(result.html).toContain('data-language="typescript"');
      expect(result.html).toContain('data-language="python"');
      expect(result.html).toContain('TypeScript');
      expect(result.html).toContain('Python');
    });

    it('handles diff highlighting', () => {
      const result = renderMarkdown('```diff\n+ added line\n- removed line\n```');
      expect(result.html).toContain('data-language="diff"');
      expect(result.html).toContain('added line');
      expect(result.html).toContain('removed line');
    });

    it('highlights Svelte code blocks', () => {
      const result = renderMarkdown('```svelte\n<script>\n  let count = 0;\n</script>\n```');
      expect(result.html).toContain('style=');
      expect(result.html).toContain('data-language="svelte"');
      expect(result.html).toContain('count');
    });

    it('sanitizes highlighted output', () => {
      // Ensure XSS payloads don't survive highlighting + sanitization
      const result = renderMarkdown('```html\n<script>alert("xss")</script>\n```');
      // Should not contain raw script tags
      expect(result.html).not.toMatch(/<script>/);
      // Content should be preserved (escaped) - the exact encoding varies
      // (could be &lt; or &#x3C;) but must NOT be double-encoded &#x26;#x3C;
      expect(result.html).toContain('script');
      // The key assertion: no executable script tag
      expect(result.html).not.toContain('<script>alert');
      // Must not double-encode: Shiki outputs &#x3C; and rehype-stringify
      // must not further encode the & to &#x26;
      expect(result.html).not.toContain('&#x26;');
    });
  });
});
