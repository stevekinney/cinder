/**
 * Unit tests for the synchronous Shiki rehype plugin.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import type { Element } from 'hast';
import { initializeHighlighter } from './highlighter.js';
import { decodeHtmlEntities, rehypeShikiSync } from './rehype-shiki-sync.js';
import {
  createCodeBlockTree,
  extractLanguageFromClass,
  extractTextFromElement,
} from './rehype-shiki-test-helpers.js';

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
        properties: {},
        children: [],
      };
      Object.defineProperty(element.properties, 'className', { value: 'language-js' });
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
        properties: {},
        children: [],
      };
      Object.defineProperty(element.properties, 'className', { value: [123, 'language-rust'] });
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
      // Single-pass: &#x26; → & in one match, leaving #x3C; as unmatched literal text,
      // so the result is &#x3C; (not <).
      expect(decodeHtmlEntities('&#x26;#x3C;')).toBe('&#x3C;');
    });

    it('does not cascade &#x26;amp; into &', () => {
      // &#x26;amp; is what Shiki emits when source code contains literal "&amp;".
      // Single-pass prevents re-scanning: &#x26; → & but the resulting &amp; is not re-decoded.
      expect(decodeHtmlEntities('&#x26;amp;')).toBe('&amp;');
    });

    it('does not cascade &amp;#x26; into &', () => {
      // &amp;#x26; represents literal "&#x26;" in source code.
      // Single-pass: &amp; → & and #x26; is literal text, so the result is &#x26; not &.
      expect(decodeHtmlEntities('&amp;#x26;')).toBe('&#x26;');
    });

    it('does not cascade &amp;#x26;lt; into <', () => {
      // &amp;#x26;lt; represents literal "&#x26;lt;" in source code.
      // Single-pass: &amp; → & leaves #x26;lt; as literal, result is &#x26;lt; not &lt; or <.
      expect(decodeHtmlEntities('&amp;#x26;lt;')).toBe('&#x26;lt;');
    });
  });

  describe('normalizeLanguage logic (via rehypeShikiSync)', () => {
    beforeAll(async () => {
      await initializeHighlighter();
    });

    it('normalizes ts to typescript', () => {
      const tree = createCodeBlockTree('const x = 1;', 'ts');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('typescript');
    });

    it('normalizes js to javascript', () => {
      const tree = createCodeBlockTree('let x = 1;', 'js');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('javascript');
    });

    it('normalizes py to python', () => {
      const tree = createCodeBlockTree('x = 1', 'py');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('python');
    });

    it('normalizes sh to bash', () => {
      const tree = createCodeBlockTree('echo hello', 'sh');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('bash');
    });

    it('normalizes shell to bash', () => {
      const tree = createCodeBlockTree('ls -la', 'shell');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('bash');
    });

    it('normalizes zsh to bash', () => {
      const tree = createCodeBlockTree('echo $PATH', 'zsh');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('bash');
    });

    it('normalizes yml to yaml', () => {
      const tree = createCodeBlockTree('key: value', 'yml');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('yaml');
    });

    it('normalizes md to markdown', () => {
      const tree = createCodeBlockTree('# Heading', 'md');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('markdown');
    });

    it('normalizes text to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'text');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('plaintext');
    });

    it('normalizes txt to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'txt');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('plaintext');
    });

    it('normalizes plain to plaintext', () => {
      const tree = createCodeBlockTree('plain text', 'plain');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('plaintext');
    });

    it('keeps valid bundled languages unchanged', () => {
      const tree = createCodeBlockTree('const x: number = 1;', 'typescript');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('typescript');
    });

    it('normalizes unknown language to plaintext', () => {
      const tree = createCodeBlockTree('unknown code', 'unknownlang');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('plaintext');
    });

    it('handles case-insensitive normalization', () => {
      const tree = createCodeBlockTree('const x = 1;', 'TypeScript');
      rehypeShikiSync()(tree);
      const pre = tree.children[0]!;
      expect(pre.properties?.['dataLanguage']).toBe('typescript');
    });
  });

  describe('rehypeShikiSync plugin', () => {
    beforeAll(async () => {
      await initializeHighlighter();
    });
  });
});
