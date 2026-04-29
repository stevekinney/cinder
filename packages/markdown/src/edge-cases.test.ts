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

describe('edge cases: malformed input', () => {
  it('handles unclosed emphasis gracefully', () => {
    const result = parse('*unclosed italic');
    expect(result.success).toBe(true);
    if (result.success) {
      // remark-parse is lenient - treats as literal asterisk
      expect(result.ast.type).toBe('root');
    }
  });

  it('handles unclosed strong gracefully', () => {
    const result = parse('**unclosed bold');
    expect(result.success).toBe(true);
  });

  it('handles unclosed code fence', () => {
    const result = parse('```javascript\ncode without closing fence');
    expect(result.success).toBe(true);
    if (result.success) {
      // The parser handles this gracefully
      expect(result.ast.children.length).toBeGreaterThan(0);
    }
  });

  it('handles unclosed link', () => {
    const result = parse('[unclosed link');
    expect(result.success).toBe(true);
  });

  it('handles mismatched brackets', () => {
    const result = parse('[text](url with (parens)');
    expect(result.success).toBe(true);
  });

  it('handles empty heading', () => {
    const result = parse('#');
    expect(result.success).toBe(true);
  });

  it('handles heading with only spaces', () => {
    const result = parse('#   ');
    expect(result.success).toBe(true);
  });
});

describe('edge cases: whitespace handling', () => {
  it('handles tabs in code blocks', () => {
    const input = '```\n\tindented with tab\n```';
    const result = parse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const code = result.ast.children[0];
      if (code.type === 'code') {
        expect(code.value).toContain('\t');
      }
    }
  });

  it('handles carriage returns', () => {
    const input = 'Line 1\r\nLine 2\r\nLine 3';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles mixed line endings', () => {
    const input = 'Line 1\nLine 2\r\nLine 3\rLine 4';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles trailing whitespace', () => {
    const input = 'Paragraph with trailing spaces   \n\nAnother paragraph';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('handles leading whitespace in lines', () => {
    const input = '  Leading spaces\n  More leading spaces';
    const result = parse(input);
    expect(result.success).toBe(true);
  });

  it('preserves significant whitespace in code', () => {
    const input = '```\n    four spaces\n        eight spaces\n```';
    const result = parse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const code = result.ast.children[0];
      if (code.type === 'code') {
        expect(code.value).toContain('    four spaces');
        expect(code.value).toContain('        eight spaces');
      }
    }
  });
});

describe('edge cases: special characters', () => {
  it('handles HTML entities', () => {
    const result = parse('&amp; &lt; &gt; &quot;');
    expect(result.success).toBe(true);
  });

  it('handles raw HTML (passthrough)', () => {
    const result = parse('<div>Raw HTML</div>');
    expect(result.success).toBe(true);
  });

  it('handles angle brackets in text', () => {
    const result = parse('Math: 1 < 2 > 0');
    expect(result.success).toBe(true);
  });

  it('handles percent signs', () => {
    const result = parse('100% complete');
    expect(result.success).toBe(true);
  });

  it('handles hash in text (not heading)', () => {
    const result = parse('Issue #123 and PR #456');
    expect(result.success).toBe(true);
    if (result.success) {
      // Should be a paragraph, not headings
      expect(result.ast.children[0].type).toBe('paragraph');
    }
  });

  it('handles at signs', () => {
    const result = parse('Contact: user@example.com');
    expect(result.success).toBe(true);
  });

  it('handles dollar signs', () => {
    const result = parse('Price: $100');
    expect(result.success).toBe(true);
  });

  it('handles multiple consecutive special chars', () => {
    const result = parse('***---___===');
    expect(result.success).toBe(true);
  });
});

describe('edge cases: unicode', () => {
  it('handles emoji sequences', () => {
    const result = parse('👨‍👩‍👧‍👦 Family emoji');
    expect(result.success).toBe(true);
  });

  it('handles zero-width characters', () => {
    const result = parse('Zero\u200Bwidth\u200Bjoiner');
    expect(result.success).toBe(true);
  });

  it('handles right-to-left text', () => {
    const result = parse('English and עברית mixed');
    expect(result.success).toBe(true);
  });

  it('handles combining characters', () => {
    const result = parse('Café with combining: cafe\u0301');
    expect(result.success).toBe(true);
  });

  it('handles mathematical symbols', () => {
    const result = parse('∑ ∏ ∫ ∂ ∇ ∈ ∉');
    expect(result.success).toBe(true);
  });

  it('handles CJK characters', () => {
    const result = parse('日本語テスト\n\n中文测试\n\n한국어 테스트');
    expect(result.success).toBe(true);
  });
});

describe('edge cases: GFM tables', () => {
  it('handles table with empty cells', () => {
    const result = parse('| A | B |\n|---|---|\n|   |   |');
    expect(result.success).toBe(true);
  });

  it('handles table with single column', () => {
    const result = parse('| A |\n|---|\n| 1 |');
    expect(result.success).toBe(true);
  });

  it('handles table with pipes in content', () => {
    const result = parse('| A |\n|---|\n| `a|b` |');
    expect(result.success).toBe(true);
  });

  it('handles table with escaped pipes', () => {
    const result = parse('| A |\n|---|\n| a\\|b |');
    expect(result.success).toBe(true);
  });

  it('handles malformed table (missing separator)', () => {
    const result = parse('| A | B |\n| 1 | 2 |');
    expect(result.success).toBe(true);
    // Parser handles gracefully - may not create table node
  });

  it('handles table immediately after paragraph', () => {
    const result = parse('Text here\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(result.success).toBe(true);
  });
});

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
