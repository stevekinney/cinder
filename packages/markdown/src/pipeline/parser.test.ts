/**
 * Unit tests for the Markdown parser.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 */

import { describe, expect, it } from 'bun:test';
import { MarkdownParseError } from './errors.js';
import { parse, parseOrThrow } from './parser.js';

describe('parse', () => {
  it('parses a simple paragraph', () => {
    const result = parse('Hello world');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.type).toBe('root');
      expect(result.ast.children).toHaveLength(1);
      expect(result.ast.children[0].type).toBe('paragraph');
    }
  });

  it('parses headings', () => {
    const result = parse('# Title\n\n## Subtitle');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.children).toHaveLength(2);
      expect(result.ast.children[0].type).toBe('heading');
      expect(result.ast.children[1].type).toBe('heading');

      const h1 = result.ast.children[0];
      const h2 = result.ast.children[1];
      if (h1.type === 'heading' && h2.type === 'heading') {
        expect(h1.depth).toBe(1);
        expect(h2.depth).toBe(2);
      }
    }
  });

  it('parses emphasis and strong', () => {
    const result = parse('*italic* and **bold**');

    expect(result.success).toBe(true);
    if (result.success) {
      const para = result.ast.children[0];
      if (para.type === 'paragraph') {
        expect(para.children.some((c) => c.type === 'emphasis')).toBe(true);
        expect(para.children.some((c) => c.type === 'strong')).toBe(true);
      }
    }
  });

  it('parses GFM strikethrough', () => {
    const result = parse('~~deleted~~');

    expect(result.success).toBe(true);
    if (result.success) {
      const para = result.ast.children[0];
      if (para.type === 'paragraph') {
        expect(para.children.some((c) => c.type === 'delete')).toBe(true);
      }
    }
  });

  it('parses GFM task lists', () => {
    const result = parse('- [x] Done\n- [ ] Todo');

    expect(result.success).toBe(true);
    if (result.success) {
      const list = result.ast.children[0];
      if (list.type === 'list') {
        expect(list.children).toHaveLength(2);
        const item1 = list.children[0];
        const item2 = list.children[1];
        if (item1.type === 'listItem' && item2.type === 'listItem') {
          expect(item1.checked).toBe(true);
          expect(item2.checked).toBe(false);
        }
      }
    }
  });

  it('parses GFM tables', () => {
    const result = parse('| A | B |\n|---|---|\n| 1 | 2 |');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.children[0].type).toBe('table');
    }
  });

  it('parses fenced code blocks', () => {
    const result = parse('```javascript\nconst x = 1;\n```');

    expect(result.success).toBe(true);
    if (result.success) {
      const code = result.ast.children[0];
      if (code.type === 'code') {
        expect(code.lang).toBe('javascript');
        expect(code.value).toBe('const x = 1;');
      }
    }
  });

  it('parses images with alt text and title', () => {
    const result = parse('![Image description](https://example.com/image.png "Optional title")');

    expect(result.success).toBe(true);
    if (result.success) {
      const paragraph = result.ast.children[0];
      expect(paragraph.type).toBe('paragraph');

      if (paragraph.type === 'paragraph') {
        const image = paragraph.children[0];
        expect(image.type).toBe('image');

        if (image.type === 'image') {
          expect(image.url).toBe('https://example.com/image.png');
          expect(image.alt).toBe('Image description');
          expect(image.title).toBe('Optional title');
        }
      }
    }
  });

  it('includes position data by default', () => {
    const result = parse('# Hello');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.position).toBeDefined();
      expect(result.ast.children[0].position).toBeDefined();

      const heading = result.ast.children[0];
      expect(heading.position?.start).toEqual({
        line: 1,
        column: 1,
        offset: 0,
      });
    }
  });

  it('strips position data when positions: false', () => {
    const result = parse('# Hello', { positions: false });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.position).toBeUndefined();
      expect(result.ast.children[0].position).toBeUndefined();
    }
  });

  it('parses empty input as empty root', () => {
    const result = parse('');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.type).toBe('root');
      expect(result.ast.children).toHaveLength(0);
    }
  });

  it('returns error for null input', () => {
    // @ts-expect-error - Testing runtime behavior with invalid input
    const result = parse(null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(MarkdownParseError);
      expect(result.error.message).toContain('null');
    }
  });

  it('returns error for undefined input', () => {
    // @ts-expect-error - Testing runtime behavior with invalid input
    const result = parse(undefined);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(MarkdownParseError);
    }
  });

  it('parses malformed markdown leniently', () => {
    // remark-parse is lenient - this just becomes paragraph text
    const result = parse('# \n\n**unclosed bold');

    expect(result.success).toBe(true);
    if (result.success) {
      // The parser will handle this gracefully
      expect(result.ast.type).toBe('root');
    }
  });
});

describe('parseOrThrow', () => {
  it('returns AST for valid input', () => {
    const ast = parseOrThrow('# Hello');

    expect(ast.type).toBe('root');
    expect(ast.children[0].type).toBe('heading');
  });

  it('throws MarkdownParseError for null input', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime behavior
      parseOrThrow(null);
    }).toThrow(MarkdownParseError);
  });

  it('throws MarkdownParseError for undefined input', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime behavior
      parseOrThrow(undefined);
    }).toThrow(MarkdownParseError);
  });
});
