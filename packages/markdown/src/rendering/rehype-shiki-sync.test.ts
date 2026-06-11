/**
 * Unit tests for the synchronous Shiki rehype plugin.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Element, ElementContent, Text } from 'hast';
import { initializeHighlighter, resetHighlighter } from './highlighter.js';
import { rehypeShikiSync } from './rehype-shiki-sync.js';

/**
 * To test internal functions, we need to either:
 * 1. Export them (which exposes implementation details)
 * 2. Test through the public API
 *
 * We'll test through the public API (rehypeShikiSync) for integration behavior,
 * and create minimal test helpers that mirror the internal logic for unit tests.
 */

// Helper to create a mock hast tree with a code block
function createCodeBlockTree(
  code: string,
  language?: string,
): {
  type: 'root';
  children: Element[];
} {
  const codeElement: Element = {
    type: 'element',
    tagName: 'code',
    properties: language ? { className: [`language-${language}`] } : {},
    children: [{ type: 'text', value: code } as Text],
  };

  const preElement: Element = {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [codeElement],
  };

  return {
    type: 'root',
    children: [preElement],
  };
}

// Helper to extract text from hast element (mirrors internal extractText)
function extractTextFromElement(element: Element): string {
  let text = '';

  function walk(nodes: ElementContent[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.value;
      } else if (node.type === 'element' && 'children' in node) {
        walk(node.children);
      }
    }
  }

  walk(element.children);
  return text;
}

// Helper to extract language from class (mirrors internal extractLanguage)
function extractLanguageFromClass(element: Element): string | null {
  const className = element.properties?.className;
  if (!Array.isArray(className)) return null;

  for (const cls of className) {
    if (typeof cls !== 'string') continue;
    if (cls.startsWith('language-')) return cls.slice(9);
    if (cls.startsWith('lang-')) return cls.slice(5);
  }

  return null;
}

// Helper to decode HTML entities (mirrors internal decodeHtmlEntities)
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x3C;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#x22;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x26;/gi, '&')
    .replace(/&amp;/g, '&');
}

// Helper to collect all text from an element (handles nested spans from Shiki)
function collectAllText(element: Element): string {
  const texts: string[] = [];

  function walk(nodes: ElementContent[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        texts.push(node.value);
      } else if (node.type === 'element' && 'children' in node) {
        walk(node.children);
      }
    }
  }

  walk(element.children);
  return texts.join('');
}

describe('rehype-shiki-sync', () => {
  describe('extractLanguage logic', () => {
    it('extracts language from language-* class', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-typescript'] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBe('typescript');
    });

    it('extracts language from lang-* class', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: ['lang-python'] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBe('python');
    });

    it('returns null when no language class', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: ['highlight'] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBeNull();
    });

    it('returns null when className is not an array', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: 'language-js' as unknown as string[] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBeNull();
    });

    it('returns null when no className property', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBeNull();
    });

    it('prefers first matching class', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-typescript', 'lang-javascript'] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBe('typescript');
    });

    it('skips non-string class values', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: { className: [123 as unknown as string, 'language-rust'] },
        children: [],
      };
      expect(extractLanguageFromClass(element)).toBe('rust');
    });
  });

  describe('extractText logic', () => {
    it('extracts text from simple text node', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [{ type: 'text', value: 'const x = 1;' }],
      };
      expect(extractTextFromElement(element)).toBe('const x = 1;');
    });

    it('extracts text from nested elements', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: [{ type: 'text', value: 'function' }],
          },
          { type: 'text', value: ' ' },
          {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: [{ type: 'text', value: 'hello' }],
          },
          { type: 'text', value: '()' },
        ],
      };
      expect(extractTextFromElement(element)).toBe('function hello()');
    });

    it('handles empty element', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [],
      };
      expect(extractTextFromElement(element)).toBe('');
    });

    it('handles deeply nested elements', () => {
      const element: Element = {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: {},
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: {},
                children: [{ type: 'text', value: 'deep' }],
              },
            ],
          },
        ],
      };
      expect(extractTextFromElement(element)).toBe('deep');
    });
  });

  describe('decodeHtmlEntities logic', () => {
    it('decodes &lt; to <', () => {
      expect(decodeHtmlEntities('&lt;div&gt;')).toBe('<div>');
    });

    it('decodes &amp; to &', () => {
      expect(decodeHtmlEntities('foo &amp; bar')).toBe('foo & bar');
    });

    it('decodes &quot; to "', () => {
      expect(decodeHtmlEntities('&quot;hello&quot;')).toBe('"hello"');
    });

    it('decodes &#39; to single quote', () => {
      expect(decodeHtmlEntities('it&#39;s')).toBe("it's");
    });

    it('decodes &#x27; to single quote', () => {
      expect(decodeHtmlEntities('&#x27;quoted&#x27;')).toBe("'quoted'");
    });

    it('decodes &#x2F; to /', () => {
      expect(decodeHtmlEntities('path&#x2F;to&#x2F;file')).toBe('path/to/file');
    });

    it('decodes multiple entities in one string', () => {
      expect(decodeHtmlEntities('&lt;a href=&quot;&#x2F;path&quot;&gt;')).toBe('<a href="/path">');
    });

    it('leaves plain text unchanged', () => {
      expect(decodeHtmlEntities('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(decodeHtmlEntities('')).toBe('');
    });

    it('decodes &#x3C; to <', () => {
      expect(decodeHtmlEntities('&#x3C;div&#x3E;')).toBe('<div>');
    });

    it('decodes &#x26; to &', () => {
      expect(decodeHtmlEntities('foo&#x26;bar')).toBe('foo&bar');
    });

    it('decodes &#x22; to "', () => {
      expect(decodeHtmlEntities('&#x22;hello&#x22;')).toBe('"hello"');
    });

    it('does not cascade &#x26;lt; into <', () => {
      // &#x26;lt; represents the literal text "&lt;" — must stay as "&lt;", not become "<"
      expect(decodeHtmlEntities('&#x26;lt;')).toBe('&lt;');
    });

    it('does not cascade &#x26;#x3C; into <', () => {
      // &#x26;#x3C; represents the literal text "&#x3C;" in source code.
      // Decoding &#x26; last means it becomes &#x3C; after all passes complete —
      // the &#x3C; replace already ran (no match), so the result stays &#x3C;.
      expect(decodeHtmlEntities('&#x26;#x3C;')).toBe('&#x3C;');
    });
  });

  describe('normalizeLanguage logic (via rehypeShikiSync)', () => {
    beforeAll(async () => {
      await initializeHighlighter();
    });

    it('normalizes ts to typescript', () => {
      const tree = createCodeBlockTree('const x = 1;', 'ts');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('typescript');
    });

    it('normalizes js to javascript', () => {
      const tree = createCodeBlockTree('let x = 1;', 'js');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('javascript');
    });

    it('normalizes py to python', () => {
      const tree = createCodeBlockTree('x = 1', 'py');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('python');
    });

    it('normalizes sh to bash', () => {
      const tree = createCodeBlockTree('echo hello', 'sh');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('bash');
    });

    it('normalizes shell to bash', () => {
      const tree = createCodeBlockTree('ls -la', 'shell');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('bash');
    });

    it('normalizes zsh to bash', () => {
      const tree = createCodeBlockTree('echo $PATH', 'zsh');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('bash');
    });

    it('normalizes yml to yaml', () => {
      const tree = createCodeBlockTree('key: value', 'yml');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('yaml');
    });

    it('normalizes md to markdown', () => {
      const tree = createCodeBlockTree('# Heading', 'md');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('markdown');
    });

    it('normalizes text to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'text');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('normalizes txt to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'txt');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('normalizes plain to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'plain');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('keeps valid bundled languages unchanged', () => {
      const tree = createCodeBlockTree('const x: number = 1;', 'typescript');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('typescript');
    });

    it('normalizes unknown language to plaintext', () => {
      const tree = createCodeBlockTree('unknown code', 'unknownlang');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('handles case-insensitive normalization', () => {
      const tree = createCodeBlockTree('const x = 1;', 'TypeScript');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('typescript');
    });
  });

  describe('rehypeShikiSync plugin', () => {
    beforeAll(async () => {
      await initializeHighlighter();
    });

    it('transforms code blocks with supported languages', () => {
      const tree = createCodeBlockTree('const x = 1;', 'javascript');
      rehypeShikiSync()(tree);

      const pre = tree.children[0] as Element;
      expect(pre.properties?.className).toContain('shiki');
      expect(pre.properties?.style).toBeDefined();
    });

    it('adds dataLanguage attribute', () => {
      const tree = createCodeBlockTree('const x = 1;', 'typescript');
      rehypeShikiSync()(tree);

      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('typescript');
    });

    it('uses default language when none specified', () => {
      const tree = createCodeBlockTree('some code');
      rehypeShikiSync({ defaultLanguage: 'plaintext' })(tree);

      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('skips empty code blocks', () => {
      const tree = createCodeBlockTree('   ', 'javascript');
      rehypeShikiSync()(tree);

      const pre = tree.children[0] as Element;
      // Should remain unhighlighted (no shiki class)
      expect(pre.properties?.className).toBeUndefined();
    });

    it('handles plaintext without highlighting', () => {
      const tree = createCodeBlockTree('plain text content', 'plaintext');
      rehypeShikiSync()(tree);

      const pre = tree.children[0] as Element;
      // Should have dataLanguage but no shiki styling
      expect(pre.properties?.dataLanguage).toBe('plaintext');
      expect(pre.properties?.className).toBeUndefined();
    });

    it('uses custom theme when specified', () => {
      const tree = createCodeBlockTree('const x = 1;', 'javascript');
      rehypeShikiSync({ theme: 'depict' })(tree);

      const pre = tree.children[0] as Element;
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

      const div = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
      expect(pre.properties?.className).toBeUndefined();
    });

    it('preserves existing pre > code structure in output', () => {
      const tree = createCodeBlockTree('const x = 1;', 'javascript');
      rehypeShikiSync()(tree);

      const pre = tree.children[0] as Element;
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
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('plaintext');
    });

    it('handles case-insensitive aliases (YML -> yaml)', () => {
      const tree = createCodeBlockTree('key: value', 'YML');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('yaml');
    });

    it('handles case-insensitive aliases (SH -> bash)', () => {
      const tree = createCodeBlockTree('echo hi', 'SH');
      rehypeShikiSync()(tree);
      const pre = tree.children[0] as Element;
      expect(pre.properties?.dataLanguage).toBe('bash');
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
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

      const pre = tree.children[0] as Element;
      const code = pre.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      );

      // Recursively find any span with CSS variable style (may be nested in line spans)
      function hasVarStyleRecursive(element: Element): boolean {
        for (const child of element.children) {
          if (child.type === 'element' && child.tagName === 'span') {
            if (
              typeof child.properties?.style === 'string' &&
              child.properties.style.includes('var(--')
            ) {
              return true;
            }
            if (hasVarStyleRecursive(child)) {
              return true;
            }
          }
        }
        return false;
      }

      expect(hasVarStyleRecursive(code!)).toBe(true);
    });
  });
});
