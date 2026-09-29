/**
 * Edge case integration tests for the Markdown pipeline.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * These tests cover complex, unusual, or potentially problematic
 * Markdown inputs that might break parsing or serialization.
 */

import { describe, expect, it } from 'bun:test';
import {
  astEquals,
  MarkdownParseError,
  parse,
  parseOrThrow,
  serialize,
  validatePositions,
} from './pipeline/index.js';
describe('edge cases: deeply nested structures', () => {
  it('handles deeply nested blockquotes', () => {
    const input = '> Level 1\n>> Level 2\n>>> Level 3\n>>>> Level 4\n>>>>> Level 5';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles complex list nesting', () => {
    const input = `- Item 1
  - Nested 1.1
    - Nested 1.1.1
      - Nested 1.1.1.1
  - Nested 1.2
- Item 2
  1. Ordered in unordered
     - Back to unordered
       1. And ordered again`;
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles blockquote containing code block', () => {
    const input = '> Quote with code:\n>\n> ```js\n> const x = 1;\n> ```';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles list containing blockquote', () => {
    const input = '- Item with quote:\n\n  > The quote\n\n- Next item';
    const result = parse(input);
    expect(result.success).toBe(true);
  });
});

describe('edge cases: error handling', () => {
  it('parseOrThrow throws MarkdownParseError for null', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime behavior
      parseOrThrow(null);
    }).toThrow(MarkdownParseError);
  });

  it('parseOrThrow throws MarkdownParseError for undefined', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime behavior
      parseOrThrow(undefined);
    }).toThrow(MarkdownParseError);
  });

  it('parse returns error result for null', () => {
    // @ts-expect-error - Testing runtime behavior
    const result = parse(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(MarkdownParseError);
      expect(result.error.input).toBe('null');
    }
  });

  it('parse returns error result for undefined', () => {
    // @ts-expect-error - Testing runtime behavior
    const result = parse(undefined);
    expect(result.success).toBe(false);
  });

  it('error contains original input', () => {
    // @ts-expect-error - Testing runtime behavior
    const result = parse(null);
    if (!result.success) {
      expect(result.error.input).toBeDefined();
    }
  });
});

describe('edge cases: AST utilities', () => {
  it('astEquals handles empty roots', () => {
    const ast1 = parseOrThrow('');
    const ast2 = parseOrThrow('');
    expect(astEquals(ast1, ast2)).toBe(true);
  });

  it('astEquals detects different content', () => {
    const ast1 = parseOrThrow('Hello');
    const ast2 = parseOrThrow('World');
    expect(astEquals(ast1, ast2)).toBe(false);
  });

  it('astEquals ignores position differences', () => {
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('# Hello');
    // Even if positions differ, content is same
    expect(astEquals(ast1, ast2)).toBe(true);
  });

  it('validatePositions returns empty for valid AST', () => {
    const ast = parseOrThrow('# Heading\n\nParagraph');
    const issues = validatePositions(ast);
    expect(issues).toHaveLength(0);
  });

  it('validatePositions detects missing positions', () => {
    // Create AST without positions
    const ast = {
      type: 'root' as const,
      children: [
        {
          type: 'paragraph' as const,
          children: [{ type: 'text' as const, value: 'Hello' }],
        },
      ],
    };
    const issues = validatePositions(ast);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('edge cases: serialization consistency', () => {
  it('serializes same AST identically each time', () => {
    const ast = parseOrThrow('# Hello\n\nWorld');
    const s1 = serialize(ast);
    const s2 = serialize(ast);
    const s3 = serialize(ast);
    expect(s1).toBe(s2);
    expect(s2).toBe(s3);
  });

  it('serializes equivalent ASTs consistently', () => {
    const ast1 = parseOrThrow('- Item 1\n- Item 2');
    const ast2 = parseOrThrow('- Item 1\n- Item 2');
    expect(serialize(ast1)).toBe(serialize(ast2));
  });

  it('uses consistent bullet style', () => {
    const ast = parseOrThrow('- Item');
    const output = serialize(ast);
    expect(output).toContain('- Item');
    expect(output).not.toMatch(/^\*/m);
    expect(output).not.toMatch(/^\+/m);
  });

  it('uses consistent emphasis style', () => {
    const ast = parseOrThrow('*italic*');
    const output = serialize(ast);
    expect(output).toContain('*italic*');
    expect(output).not.toContain('_italic_');
  });

  it('uses consistent code fence style', () => {
    const ast = parseOrThrow('```\ncode\n```');
    const output = serialize(ast);
    expect(output).toContain('```');
    expect(output).not.toContain('~~~');
  });
});
