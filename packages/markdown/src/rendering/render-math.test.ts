/**
 * Unit tests for LaTeX/math rendering in the markdown pipeline.
 *
 * Math rendering goes through `renderMarkdownWithMath`, which dynamically
 * imports remark-math + rehype-katex on first math input. The sync
 * `renderMarkdown` deliberately does not handle math — math input passes
 * through as raw text. These tests cover both: math through the async
 * entry, and the no-math behavior on the sync entry.
 *
 * Also covers `probablyHasMath` — the cheap pre-check that decides
 * whether the math chunk needs to load.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  __setMathPluginLoaderForTests,
  clearRenderCache,
  probablyHasMath,
  renderMarkdown,
  renderMarkdownWithMath,
} from './render.js';

describe('math rendering', () => {
  beforeEach(() => {
    clearRenderCache();
  });

  describe('inline math', () => {
    it('renders inline math with KaTeX output', async () => {
      const result = await renderMarkdownWithMath('The formula $E=mc^2$ is famous.');

      // KaTeX wraps output in a span with class="katex"
      expect(result.html).toContain('katex');
      // The raw LaTeX dollar syntax should not appear literally
      expect(result.html).not.toContain('$E=mc^2$');
    });

    it('inline math is wrapped inside a paragraph', async () => {
      const result = await renderMarkdownWithMath('Inline: $x^2$');

      expect(result.html).toContain('<p>');
      expect(result.html).toContain('katex');
    });

    it('renders multiple inline math expressions independently', async () => {
      const result = await renderMarkdownWithMath('First $a+b$ and second $c-d$.');

      // Two KaTeX wrappers should be present
      const katexCount = (result.html.match(/class="katex"/g) ?? []).length;
      expect(katexCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('display (block) math', () => {
    it('renders display math as a block-level element', async () => {
      const result = await renderMarkdownWithMath('$$\n\\int_0^1 x^2 dx\n$$');

      expect(result.html).toContain('katex-display');
      expect(result.html).not.toContain('$$\n');
    });

    it('renders display math surrounded by paragraphs', async () => {
      const result = await renderMarkdownWithMath(
        'Before.\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\nAfter.',
      );

      expect(result.html).toContain('Before.');
      expect(result.html).toContain('After.');
      expect(result.html).toContain('katex-display');
    });
  });

  describe('MathML accessibility output', () => {
    it('includes MathML markup for screen readers', async () => {
      const result = await renderMarkdownWithMath('$x^2$');
      expect(result.html).toContain('<math');
    });

    it('preserves the LaTeX source in annotation for accessibility', async () => {
      const result = await renderMarkdownWithMath('$E=mc^2$');
      expect(result.html).toContain('annotation');
    });
  });

  describe('mixed content', () => {
    it('renders math alongside code blocks without interference', async () => {
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

      const result = await renderMarkdownWithMath(markdown);

      expect(result.html).toContain('katex');
      expect(result.html).toContain('katex-display');
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('energy');
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBe('typescript');
    });

    it('renders math alongside GFM tables without interference', async () => {
      const markdown = [
        '| Variable | Formula |',
        '|----------|---------|',
        '| Energy   | $E=mc^2$ |',
        '',
        '$$',
        'F = ma',
        '$$',
      ].join('\n');

      const result = await renderMarkdownWithMath(markdown);

      expect(result.html).toContain('<table>');
      expect(result.html).toContain('katex');
      expect(result.html).toContain('katex-display');
    });

    it('renders math alongside emphasis and inline code', async () => {
      const result = await renderMarkdownWithMath('**Bold** and `code` and $x = y$.');

      expect(result.html).toContain('<strong>Bold</strong>');
      expect(result.html).toContain('<code>code</code>');
      expect(result.html).toContain('katex');
    });
  });

  describe('invalid LaTeX', () => {
    it('does not throw on invalid LaTeX — renders error markup instead', async () => {
      // rehype-katex sets throwOnError=false by default
      await expect(renderMarkdownWithMath('$\\invalidcommand{broken$')).resolves.toBeDefined();
    });

    it('produces output even for malformed LaTeX', async () => {
      const result = await renderMarkdownWithMath('$\\invalidcommand$');
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.html).not.toBe('');
    });

    it('renders surrounding content correctly even when LaTeX is invalid', async () => {
      const result = await renderMarkdownWithMath('Before $\\broken{$ after.');
      expect(result.html).toContain('Before');
      expect(result.html).toContain('after');
    });
  });

  describe('existing rendering is not broken', () => {
    it('still renders headings correctly', async () => {
      const result = await renderMarkdownWithMath('# Heading 1\n\n## Heading 2');
      expect(result.html).toContain('<h1>Heading 1</h1>');
      expect(result.html).toContain('<h2>Heading 2</h2>');
    });

    it('still renders GFM tables correctly', async () => {
      const result = await renderMarkdownWithMath('| A | B |\n|---|---|\n| 1 | 2 |');
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<th>A</th>');
      expect(result.html).toContain('<td>1</td>');
    });

    it('still renders code fences correctly', async () => {
      const result = await renderMarkdownWithMath('```js\nconsole.log("hello");\n```');
      expect(result.html).toContain('<pre');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('console');
      expect(result.html).toContain('log');
    });

    it('still renders task lists correctly', async () => {
      const result = await renderMarkdownWithMath('- [ ] Unchecked\n- [x] Checked');
      expect(result.html).toContain('type="checkbox"');
      expect(result.html).toContain('disabled');
    });

    it('still renders strikethrough correctly', async () => {
      const result = await renderMarkdownWithMath('~~deleted~~');
      expect(result.html).toContain('<del>deleted</del>');
    });

    it('still sanitizes raw HTML', async () => {
      const result = await renderMarkdownWithMath('<script>alert("xss")</script>');
      expect(result.html).not.toContain('<script>');
      expect(result.hadUnsafeContent).toBe(true);
    });

    it('still strips unsafe URLs', async () => {
      const result = await renderMarkdownWithMath('[click](javascript:alert(1))');
      expect(result.html).not.toContain('javascript:');
    });

    it('still preserves rawMarkdown', async () => {
      const input = '$E=mc^2$';
      const result = await renderMarkdownWithMath(input);
      expect(result.rawMarkdown).toBe(input);
    });

    it('still returns code block metadata', async () => {
      const result = await renderMarkdownWithMath(
        '```python title=example.py\nprint("hello")\n```',
      );
      expect(result.codeBlocks).toHaveLength(1);
      expect(result.codeBlocks[0].language).toBe('python');
      expect(result.codeBlocks[0].meta).toBe('title=example.py');
    });
  });

  describe('sanitization of KaTeX output', () => {
    it('allows KaTeX span elements through sanitization', async () => {
      const result = await renderMarkdownWithMath('$a+b$');
      expect(result.html).toContain('span');
      expect(result.html).toContain('katex');
    });

    it('allows MathML math element through sanitization', async () => {
      const result = await renderMarkdownWithMath('$x^2$');
      expect(result.html).toContain('<math');
    });

    it('allows display math attribute through sanitization', async () => {
      const result = await renderMarkdownWithMath('$$\nx^2\n$$');
      expect(result.html).toContain('display="block"');
    });
  });

  describe('edge cases', () => {
    it('does not throw on empty display math delimiters', async () => {
      await expect(renderMarkdownWithMath('$$')).resolves.toBeDefined();
    });

    it('does not treat dollar signs inside code fences as math', async () => {
      const markdown = '```\nconst price = $100;\n```';
      const result = await renderMarkdownWithMath(markdown);

      expect(result.html).toContain('$100');
      expect(result.html).not.toContain('katex');
    });

    it('does not treat dollar signs inside inline code as math', async () => {
      const result = await renderMarkdownWithMath('Use `$variable` in your shell.');

      expect(result.html).toContain('<code>$variable</code>');
      expect(result.html).not.toContain('katex');
    });

    it('renders error markup for unclosed braces without crashing', async () => {
      const result = await renderMarkdownWithMath('$\\frac{$');
      expect(result.html.length).toBeGreaterThan(0);
    });

    it('renders consecutive inline math expressions independently', async () => {
      const result = await renderMarkdownWithMath('$a$ then $b$ then $c$');

      const katexCount = (result.html.match(/class="katex"/g) ?? []).length;
      expect(katexCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('sync renderMarkdown does NOT render math (deliberate behavior change)', () => {
    it('passes inline $…$ through as raw text', () => {
      const result = renderMarkdown('Inline: $x^2$');
      expect(result.html).not.toContain('katex');
      // Math source passes through escaped/literal somewhere in the body.
      expect(result.html).toContain('x^2');
    });

    it('passes display $$…$$ through without rendering math', () => {
      const result = renderMarkdown('$$\n\\sum_i\n$$');
      expect(result.html).not.toContain('katex-display');
    });
  });
});

describe('probablyHasMath', () => {
  // Required true cases — failures here would silently break math rendering.
  const trueCases: Array<[string, string]> = [
    ['inline single-character body', 'inline $x$ math'],
    ['inline multi-character body', '$x^2$'],
    ['inline math mid-string', 'a $f(x)$ b'],
    ['display block', '$$\n\\sum_i\n$$'],
    ['compact display', '$$x$$'],
    ['inline after newline (single char)', 'line one\nthen $a$'],
  ];
  for (const [name, input] of trueCases) {
    it(`returns true for ${name}: ${JSON.stringify(input)}`, () => {
      expect(probablyHasMath(input)).toBe(true);
    });
  }

  // Required false cases — these would otherwise force unnecessary chunk loads.
  const falseCases: Array<[string, string]> = [
    ['no $ at all', 'plain text'],
    ['lone currency $5', '$5'],
    ['currency in sentence', 'costs $5 today'],
    ['shell prompt', 'shell prompt: $ ls'],
    ['escaped dollar', '\\$escaped'],
    ['inline code', '`$inline code`'],
    ['fenced code', '```\n$x\n```'],
    ['tilde-fenced code', '~~~\n$x\n~~~'],
    ['trailing $', '$ at end'],
  ];
  for (const [name, input] of falseCases) {
    it(`returns false for ${name}: ${JSON.stringify(input)}`, () => {
      expect(probablyHasMath(input)).toBe(false);
    });
  }
});

describe('math-plugin loader is called only on math input', () => {
  let restore: () => void;
  let calls: number;

  beforeEach(() => {
    calls = 0;
    restore = __setMathPluginLoaderForTests(async () => {
      calls += 1;
      const [m, k] = await Promise.all([import('remark-math'), import('rehype-katex')]);
      return { remarkMath: m.default, rehypeKatex: k.default };
    });
    clearRenderCache();
  });

  afterEach(() => {
    restore();
  });

  it('does not call the loader for math-free input', async () => {
    await renderMarkdownWithMath('# hello');
    expect(calls).toBe(0);
  });

  it('calls the loader exactly once for the first math render', async () => {
    await renderMarkdownWithMath('$x^2$');
    expect(calls).toBe(1);
  });

  it('does not re-call the loader for a second math render (singleton survives)', async () => {
    await renderMarkdownWithMath('$x^2$');
    await renderMarkdownWithMath('$y^3$');
    expect(calls).toBe(1);
  });
});
