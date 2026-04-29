/**
 * Unit tests for LaTeX/math rendering in the markdown pipeline.
 *
 * Verifies that remark-math + rehype-katex are correctly integrated:
 * - Inline math ($...$) is rendered via KaTeX
 * - Display/block math ($$...$$) is rendered as a block equation
 * - Mixed content (math + code blocks) does not interfere
 * - Invalid LaTeX falls back gracefully without throwing
 * - Existing markdown features (GFM, code fences) are not broken
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { clearRenderCache, renderMarkdown } from './render.js';

describe('math rendering', () => {
  beforeEach(() => {
    clearRenderCache();
  });

  describe('inline math', () => {
    it('renders inline math with KaTeX output', () => {
      const result = renderMarkdown('The formula $E=mc^2$ is famous.');

      // KaTeX wraps output in a span with class="katex"
      expect(result.html).toContain('katex');
      // The raw LaTeX dollar syntax should not appear literally
      expect(result.html).not.toContain('$E=mc^2$');
    });

    it('inline math is wrapped inside a paragraph', () => {
      const result = renderMarkdown('Inline: $x^2$');

      expect(result.html).toContain('<p>');
      expect(result.html).toContain('katex');
    });

    it('renders multiple inline math expressions independently', () => {
      const result = renderMarkdown('First $a+b$ and second $c-d$.');

      // Two KaTeX wrappers should be present
      const katexCount = (result.html.match(/class="katex"/g) ?? []).length;
      expect(katexCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('display (block) math', () => {
    it('renders display math as a block-level element', () => {
      // Block math requires the multi-line $$ delimiter format:
      // $$
      // expression
      // $$
      // Single-line $$...$$ is treated as inline math by remark-math.
      const result = renderMarkdown('$$\n\\int_0^1 x^2 dx\n$$');

      // KaTeX marks display math with katex-display class
      expect(result.html).toContain('katex-display');
      // The block math node value should not appear as raw delimiters
      expect(result.html).not.toContain('$$\n');
    });

    it('renders display math surrounded by paragraphs', () => {
      const result = renderMarkdown(
        'Before.\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\nAfter.',
      );

      expect(result.html).toContain('Before.');
      expect(result.html).toContain('After.');
      expect(result.html).toContain('katex-display');
    });
  });

  describe('MathML accessibility output', () => {
    it('includes MathML markup for screen readers', () => {
      const result = renderMarkdown('$x^2$');

      // KaTeX always emits a <math> MathML element alongside the HTML rendering
      expect(result.html).toContain('<math');
    });

    it('preserves the LaTeX source in annotation for accessibility', () => {
      const result = renderMarkdown('$E=mc^2$');

      // KaTeX includes the original source inside <annotation encoding="application/x-tex">
      expect(result.html).toContain('annotation');
    });
  });

  describe('mixed content', () => {
    it('renders math alongside code blocks without interference', () => {
      const markdown = [
        'Use the formula $E=mc^2$ for energy.',
        '',
        '```typescript',
        'const energy = mass * Math.pow(speed, 2);',
        '```',
        '',
        'Display equation:',
        '',
        '$$',
        'F = ma',
        '$$',
      ].join('\n');

      const result = renderMarkdown(markdown);

      // Inline math rendered
      expect(result.html).toContain('katex');
      // Display math rendered
      expect(result.html).toContain('katex-display');
      // Code block rendered
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('energy');
      // Code block metadata extracted
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBe('typescript');
    });

    it('renders math alongside GFM tables without interference', () => {
      const markdown = [
        '| Variable | Formula |',
        '|----------|---------|',
        '| Energy   | $E=mc^2$ |',
        '',
        '$$',
        'F = ma',
        '$$',
      ].join('\n');

      const result = renderMarkdown(markdown);

      expect(result.html).toContain('<table>');
      // Inline math in table cell
      expect(result.html).toContain('katex');
      // Block math after table
      expect(result.html).toContain('katex-display');
    });

    it('renders math alongside emphasis and inline code', () => {
      const result = renderMarkdown('**Bold** and `code` and $x = y$.');

      expect(result.html).toContain('<strong>Bold</strong>');
      expect(result.html).toContain('<code>code</code>');
      expect(result.html).toContain('katex');
    });
  });

  describe('invalid LaTeX', () => {
    it('does not throw on invalid LaTeX — renders error markup instead', () => {
      // rehype-katex sets throwOnError=false by default
      expect(() => renderMarkdown('$\\invalidcommand{broken$')).not.toThrow();
    });

    it('produces output even for malformed LaTeX', () => {
      const result = renderMarkdown('$\\invalidcommand$');

      // Should return an HTML string (possibly with error markup), not empty
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.html).not.toBe('');
    });

    it('renders surrounding content correctly even when LaTeX is invalid', () => {
      const result = renderMarkdown('Before $\\broken{$ after.');

      // Surrounding text should still appear
      expect(result.html).toContain('Before');
      expect(result.html).toContain('after');
    });
  });

  describe('existing rendering is not broken', () => {
    it('still renders headings correctly', () => {
      const result = renderMarkdown('# Heading 1\n\n## Heading 2');
      expect(result.html).toContain('<h1>Heading 1</h1>');
      expect(result.html).toContain('<h2>Heading 2</h2>');
    });

    it('still renders GFM tables correctly', () => {
      const result = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<th>A</th>');
      expect(result.html).toContain('<td>1</td>');
    });

    it('still renders code fences correctly', () => {
      const result = renderMarkdown('```js\nconsole.log("hello");\n```');
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('console');
      expect(result.html).toContain('log');
    });

    it('still renders task lists correctly', () => {
      const result = renderMarkdown('- [ ] Unchecked\n- [x] Checked');
      expect(result.html).toContain('type="checkbox"');
      expect(result.html).toContain('disabled');
    });

    it('still renders strikethrough correctly', () => {
      const result = renderMarkdown('~~deleted~~');
      expect(result.html).toContain('<del>deleted</del>');
    });

    it('still sanitizes raw HTML', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result.html).not.toContain('<script>');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('still strips unsafe URLs', () => {
      const result = renderMarkdown('[click](javascript:alert(1))');
      expect(result.html).not.toContain('javascript:');
    });

    it('still preserves rawMarkdown', () => {
      const input = '$E=mc^2$';
      const result = renderMarkdown(input);
      expect(result.rawMarkdown).toBe(input);
    });

    it('still returns code block metadata', () => {
      const result = renderMarkdown('```python title=example.py\nprint("hello")\n```');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBe('python');
      expect(result.codeBlocks[0].meta).toBe('title=example.py');
    });
  });

  describe('sanitization of KaTeX output', () => {
    it('allows KaTeX span elements through sanitization', () => {
      const result = renderMarkdown('$a+b$');

      // KaTeX output should survive sanitization (spans with katex classes)
      expect(result.html).toContain('span');
      expect(result.html).toContain('katex');
    });

    it('allows MathML math element through sanitization', () => {
      const result = renderMarkdown('$x^2$');

      expect(result.html).toContain('<math');
    });

    it('allows display math attribute through sanitization', () => {
      // Block math requires multi-line $$ delimiters
      const result = renderMarkdown('$$\nx^2\n$$');

      // KaTeX sets display="block" on the MathML math element for block equations
      expect(result.html).toContain('display="block"');
    });
  });

  describe('edge cases', () => {
    it('does not throw on empty display math delimiters', () => {
      expect(() => renderMarkdown('$$')).not.toThrow();
    });

    it('does not treat dollar signs inside code fences as math', () => {
      const markdown = '```\nconst price = $100;\n```';
      const result = renderMarkdown(markdown);

      expect(result.html).toContain('$100');
      expect(result.html).not.toContain('katex');
    });

    it('does not treat dollar signs inside inline code as math', () => {
      const result = renderMarkdown('Use `$variable` in your shell.');

      expect(result.html).toContain('<code>$variable</code>');
      expect(result.html).not.toContain('katex');
    });

    it('renders error markup for unclosed braces without crashing', () => {
      const result = renderMarkdown('$\\frac{$');

      expect(result.html.length).toBeGreaterThan(0);
    });

    it('renders consecutive inline math expressions independently', () => {
      const result = renderMarkdown('$a$ then $b$ then $c$');

      const katexCount = (result.html.match(/class="katex"/g) ?? []).length;
      expect(katexCount).toBeGreaterThanOrEqual(3);
    });
  });
});
