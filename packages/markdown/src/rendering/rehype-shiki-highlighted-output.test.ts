/**
 * Unit tests for the synchronous Shiki rehype plugin.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Element } from 'hast';
import { initializeHighlighter, resetHighlighter } from './highlighter.js';
import { rehypeShikiSync } from './rehype-shiki-sync.js';
import { collectAllText, createCodeBlockTree } from './rehype-shiki-test-helpers.js';

function hasVarStyleRecursive(element: Element): boolean {
  for (const child of element.children) {
    if (child.type !== 'element' || child.tagName !== 'span') continue;
    if (typeof child.properties?.style === 'string' && child.properties.style.includes('var(--')) {
      return true;
    }
    if (hasVarStyleRecursive(child)) return true;
  }
  return false;
}

describe('rehypeShikiSync highlighted output', () => {
  it('transforms code blocks with supported languages', () => {
    const tree = createCodeBlockTree('const x = 1;', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    expect(pre.properties?.className).toContain('shiki');
    expect(pre.properties?.style).toBeDefined();
  });

  it('emits no phantom empty trailing line span', () => {
    // `mdast-util-to-hast` appends a trailing "\n" to every fence's text.
    // Passed to Shiki verbatim, that newline starts one more line and yields
    // a final `<span class="line"></span>` with no content — a stray blank
    // row under every code block.
    const tree = createCodeBlockTree('const x = 1;\nconst y = 2;\n', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );
    const lines = (code?.children ?? []).filter(
      (child): child is Element =>
        child.type === 'element' &&
        Array.isArray(child.properties?.className) &&
        child.properties.className.includes('line'),
    );

    expect(lines).toHaveLength(2);
    expect(collectAllText(lines[0]!)).toBe('const x = 1;');
    expect(collectAllText(lines[1]!)).toBe('const y = 2;');
    expect(lines.some((line) => collectAllText(line) === '')).toBe(false);
  });

  it('strips exactly one trailing newline, preserving deliberate blank lines', () => {
    // Only the serializer's own artifact goes. A fence is whitespace
    // significant, so `.trimEnd()` here would silently delete content the
    // author meant to keep.
    const tree = createCodeBlockTree('const x = 1;\n\n\n', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );
    const lines = (code?.children ?? []).filter(
      (child): child is Element =>
        child.type === 'element' &&
        Array.isArray(child.properties?.className) &&
        child.properties.className.includes('line'),
    );

    // "const x = 1;" plus the two blank lines the author wrote.
    expect(lines).toHaveLength(3);
    expect(collectAllText(lines[0]!)).toBe('const x = 1;');
  });

  it('adds dataLanguage attribute', () => {
    const tree = createCodeBlockTree('const x = 1;', 'typescript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    expect(pre.properties?.['dataLanguage']).toBe('typescript');
  });

  it('uses default language when none specified', () => {
    const tree = createCodeBlockTree('some code');
    rehypeShikiSync({ defaultLanguage: 'plaintext' })(tree);

    const pre = tree.children[0]!;
    expect(pre.properties?.['dataLanguage']).toBe('plaintext');
  });

  it('skips empty code blocks', () => {
    const tree = createCodeBlockTree('   ', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    // Should remain unhighlighted (no shiki class)
    expect(pre.properties?.className).toBeUndefined();
  });

  it('handles plaintext without highlighting', () => {
    const tree = createCodeBlockTree('plain text content', 'plaintext');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    // Should have dataLanguage but no shiki styling
    expect(pre.properties?.['dataLanguage']).toBe('plaintext');
    expect(pre.properties?.className).toBeUndefined();
  });

  it('uses custom theme when specified', () => {
    const tree = createCodeBlockTree('const x = 1;', 'javascript');
    rehypeShikiSync({ theme: 'depict' })(tree);

    const pre = tree.children[0]!;
    expect(pre.properties?.className).toContain('depict');
  });

  it('skips non-pre elements', () => {
    const tree = {
      type: 'root' as const,
      children: [
        {
          type: 'element' as const,
          tagName: 'div',
          properties: {},
          children: [{ type: 'text' as const, value: 'not code' }],
        },
      ],
    };

    rehypeShikiSync()(tree);

    const div = tree.children[0]! as Element;
    expect(div.tagName).toBe('div');
    expect(div.properties?.className).toBeUndefined();
  });

  it('skips pre without code child', () => {
    const tree = {
      type: 'root' as const,
      children: [
        {
          type: 'element' as const,
          tagName: 'pre',
          properties: {},
          children: [{ type: 'text' as const, value: 'not wrapped in code' }],
        },
      ],
    };

    rehypeShikiSync()(tree);

    const pre = tree.children[0]! as Element;
    expect(pre.properties?.className).toBeUndefined();
  });

  it('preserves existing pre > code structure in output', () => {
    const tree = createCodeBlockTree('const x = 1;', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    expect(pre.tagName).toBe('pre');

    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );
    expect(code).toBeDefined();
  });
});

describe('additional normalizeLanguage aliases', () => {
  beforeAll(async () => {
    await initializeHighlighter();
  });

  it('normalizes plaintext alias to plaintext', () => {
    const tree = createCodeBlockTree('some text', 'plaintext');
    rehypeShikiSync()(tree);
    const pre = tree.children[0]!;
    expect(pre.properties?.['dataLanguage']).toBe('plaintext');
  });

  it('handles case-insensitive aliases (YML -> yaml)', () => {
    const tree = createCodeBlockTree('key: value', 'YML');
    rehypeShikiSync()(tree);
    const pre = tree.children[0]!;
    expect(pre.properties?.['dataLanguage']).toBe('yaml');
  });

  it('handles case-insensitive aliases (SH -> bash)', () => {
    const tree = createCodeBlockTree('echo hi', 'SH');
    rehypeShikiSync()(tree);
    const pre = tree.children[0]!;
    expect(pre.properties?.['dataLanguage']).toBe('bash');
  });
});

describe('parseShikiHtml edge cases (via integration)', () => {
  beforeAll(async () => {
    await initializeHighlighter();
  });

  it('handles code blocks with no className on code element', () => {
    // A code block without language produces a code element with no class
    const tree = createCodeBlockTree('hello world', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    // After highlighting, there should still be a code child
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );
    expect(code).toBeDefined();
    const allText = collectAllText(code!);
    expect(allText).toContain('hello world');
  });

  it('handles empty code block gracefully', () => {
    const tree = createCodeBlockTree('', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    // Empty code blocks should be skipped (no shiki class added)
    expect(pre.properties?.className).toBeUndefined();
  });
});

describe('rehypeShikiSync without initialized highlighter', () => {
  beforeEach(() => {
    resetHighlighter();
  });

  it('leaves code blocks unchanged when highlighter not ready', () => {
    const tree = createCodeBlockTree('const x = 1;', 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    // Should not have shiki class since highlighter isn't initialized
    expect(pre.properties?.className).toBeUndefined();
  });
});

describe('parseShikiHtml and parseSpans (via integration)', () => {
  beforeAll(async () => {
    await initializeHighlighter();
  });

  it('parses Shiki output with spans into hast', () => {
    const tree = createCodeBlockTree('const x: number = 42;', 'typescript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );

    expect(code).toBeDefined();
    // Shiki wraps lines in <span class="line"> elements
    // Should have span children (line wrappers or styled tokens)
    const hasSpans = code!.children.some(
      (child): child is Element => child.type === 'element' && child.tagName === 'span',
    );
    expect(hasSpans).toBe(true);
  });

  it('preserves code content after parsing', () => {
    const originalCode = 'function hello() { return "world"; }';
    const tree = createCodeBlockTree(originalCode, 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );

    // The code element should have children (spans containing tokens)
    expect(code!.children.length).toBeGreaterThan(0);

    // Verify key tokens are present in the structure
    const allText = collectAllText(code!);
    expect(allText).toContain('function');
    expect(allText).toContain('hello');
    expect(allText).toContain('return');
    expect(allText).toContain('world');
  });

  it('handles special characters in code', () => {
    const codeWithSpecialChars = 'const x = "<>&\'";';
    const tree = createCodeBlockTree(codeWithSpecialChars, 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );

    // Verify structure exists and contains key content
    expect(code!.children.length).toBeGreaterThan(0);
    const allText = collectAllText(code!);
    expect(allText).toContain('const');
    expect(allText).toContain('x');
  });

  it('handles multiline code', () => {
    const multilineCode = 'function hello() {\n  return "world";\n}';
    const tree = createCodeBlockTree(multilineCode, 'javascript');
    rehypeShikiSync()(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );

    // The code element should have children representing multiple lines
    expect(code!.children.length).toBeGreaterThan(0);

    // Verify key tokens from different lines are present
    const allText = collectAllText(code!);
    expect(allText).toContain('function');
    expect(allText).toContain('return');
  });

  it('applies CSS variable styles', () => {
    const tree = createCodeBlockTree('const x = 1;', 'javascript');
    rehypeShikiSync({ theme: 'depict' })(tree);

    const pre = tree.children[0]!;
    const code = pre.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );

    expect(hasVarStyleRecursive(code!)).toBe(true);
  });
});
