/**
 * Unit tests for AST utility functions.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 */

import { describe, expect, it } from 'bun:test';
import type { Root } from 'mdast';
import {
  astEquals,
  contentEquals,
  diffAsts,
  normalize,
  roundTrip,
  stripPositions,
  validatePositions,
} from './ast.js';
import { parseOrThrow } from './parser.js';

describe('astEquals', () => {
  it('returns true for identical ASTs', () => {
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('# Hello');

    expect(astEquals(ast1, ast2)).toBe(true);
  });

  it('returns true for ASTs with different positions but same content', () => {
    // Parse the same logical content from different source positions
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('\n\n# Hello'); // Newlines create different positions

    // Verify positions are actually different
    expect(ast1.children[0].position?.start.line).toBe(1);
    expect(ast2.children[0].position?.start.line).toBe(3);

    // astEquals should return true because it ignores position data
    expect(astEquals(ast1, ast2)).toBe(true);
  });

  it('returns false for different ASTs', () => {
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('## Hello');

    expect(astEquals(ast1, ast2)).toBe(false);
  });

  it('returns false for ASTs with different content', () => {
    const ast1 = parseOrThrow('Hello');
    const ast2 = parseOrThrow('World');

    expect(astEquals(ast1, ast2)).toBe(false);
  });
});

describe('stripPositions', () => {
  it('removes position data from all nodes', () => {
    const ast = parseOrThrow('# Hello\n\nWorld');

    // Original has positions
    expect(ast.position).toBeDefined();
    expect(ast.children[0].position).toBeDefined();

    // Stripped does not
    const stripped = stripPositions(ast);
    expect(stripped.position).toBeUndefined();
    expect(stripped.children[0].position).toBeUndefined();
  });

  it('preserves all other properties', () => {
    const ast = parseOrThrow('# Hello');
    const stripped = stripPositions(ast);

    expect(stripped.type).toBe('root');
    expect(stripped.children[0].type).toBe('heading');

    const heading = stripped.children[0];
    if (heading.type === 'heading') {
      expect(heading.depth).toBe(1);
      expect(heading.children[0].type).toBe('text');
    }
  });

  it('does not mutate the original AST', () => {
    const ast = parseOrThrow('# Hello');
    const originalPosition = ast.position;

    stripPositions(ast);

    expect(ast.position).toBe(originalPosition);
  });
});

describe('validatePositions', () => {
  it('returns empty array when all nodes have positions', () => {
    const ast = parseOrThrow('# Heading\n\nParagraph with *emphasis*.');
    const issues = validatePositions(ast);

    expect(issues).toHaveLength(0);
  });

  it('returns issues for nodes missing positions', () => {
    // Create an AST manually without positions
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Hello' }],
        },
      ],
    };

    const issues = validatePositions(ast);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.type === 'root')).toBe(true);
    expect(issues.some((i) => i.type === 'paragraph')).toBe(true);
    expect(issues.some((i) => i.type === 'text')).toBe(true);
  });
});

describe('roundTrip', () => {
  it('passes for simple paragraph', () => {
    const result = roundTrip('Hello world');

    expect(result.passes).toBe(true);
  });

  it('passes for heading', () => {
    const result = roundTrip('# Hello');

    expect(result.passes).toBe(true);
  });

  it('passes for emphasis', () => {
    const result = roundTrip('*italic* and **bold**');

    expect(result.passes).toBe(true);
  });

  it('passes for lists', () => {
    const result = roundTrip('- Item 1\n- Item 2\n- Item 3');

    expect(result.passes).toBe(true);
  });

  it('passes for code blocks', () => {
    const result = roundTrip('```js\nconst x = 1;\n```');

    expect(result.passes).toBe(true);
  });

  it('passes for GFM tables', () => {
    const result = roundTrip('| A | B |\n|---|---|\n| 1 | 2 |');

    expect(result.passes).toBe(true);
  });

  it('passes for GFM task lists', () => {
    const result = roundTrip('- [x] Done\n- [ ] Todo');

    expect(result.passes).toBe(true);
  });

  it('passes for GFM strikethrough', () => {
    const result = roundTrip('~~deleted~~');

    expect(result.passes).toBe(true);
  });

  it('passes for images', () => {
    const result = roundTrip(
      '![Image description](https://example.com/image.png "Optional title")',
    );

    expect(result.passes).toBe(true);
  });

  it('passes for links (attachments)', () => {
    const result = roundTrip('[document.pdf](https://example.com/document.pdf)');

    expect(result.passes).toBe(true);
  });

  it('passes for complex mixed content', () => {
    const markdown = `# Title

Paragraph with *em* and **strong**.

- List item 1
- List item 2

\`\`\`typescript
const x = 1;
\`\`\`

| Header |
|--------|
| Cell   |`;

    const result = roundTrip(markdown);

    expect(result.passes).toBe(true);
  });

  it('includes serialized markdown in result', () => {
    const result = roundTrip('# Hello');

    expect(result.serialized).toContain('# Hello');
  });
});

describe('diffAsts', () => {
  it('returns null for identical ASTs', () => {
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('# Hello');

    expect(diffAsts(ast1, ast2)).toBeNull();
  });

  it('returns diff string for different ASTs', () => {
    const ast1 = parseOrThrow('# Hello');
    const ast2 = parseOrThrow('## Hello');

    const diff = diffAsts(ast1, ast2);

    expect(diff).not.toBeNull();
    expect(diff).toContain('ASTs differ');
  });
});

describe('position preservation', () => {
  it('all nodes have position data after parsing', () => {
    const markdown = '# Heading\n\nParagraph with *emphasis*.';
    const ast = parseOrThrow(markdown);
    const issues = validatePositions(ast);

    expect(issues).toHaveLength(0);
  });

  it('positions are accurate for heading', () => {
    const markdown = '# Hello';
    const ast = parseOrThrow(markdown);

    expect(ast.children[0].position?.start).toEqual({
      line: 1,
      column: 1,
      offset: 0,
    });

    expect(ast.children[0].position?.end).toEqual({
      line: 1,
      column: 8,
      offset: 7,
    });
  });

  it('positions span multiple lines correctly', () => {
    const markdown = 'Line 1\n\nLine 2';
    const ast = parseOrThrow(markdown);

    // First paragraph
    expect(ast.children[0].position?.start.line).toBe(1);

    // Second paragraph
    expect(ast.children[1].position?.start.line).toBe(3);
  });
});

describe('normalize', () => {
  it('normalizes list markers (* vs -)', () => {
    const star = normalize('* item 1\n* item 2');
    const dash = normalize('- item 1\n- item 2');

    expect(star).toBe(dash);
  });

  it('handles trailing newline differences', () => {
    const withoutTrailing = normalize('# Hello');
    const withTrailing = normalize('# Hello\n');

    expect(withoutTrailing).toBe(withTrailing);
  });

  it('collapses excessive newlines', () => {
    const result = normalize('# Hello\n\n\n\nWorld');

    // Should have max 2 newlines between paragraphs
    expect(result).not.toContain('\n\n\n');
  });

  it('handles empty content', () => {
    expect(normalize('')).toBe('\n');
    expect(normalize('   ')).toBe('\n');
    expect(normalize('\n\n')).toBe('\n');
  });

  it('removes leading newlines', () => {
    const result = normalize('\n\n# Hello');

    expect(result).not.toMatch(/^\n/);
    expect(result).toMatch(/^#/);
  });

  it('always ends with single newline', () => {
    expect(normalize('Hello')).toMatch(/\n$/);
    expect(normalize('Hello\n\n\n')).toMatch(/[^\n]\n$/);
  });
});

describe('contentEquals', () => {
  it('returns true for identical strings', () => {
    expect(contentEquals('# Hello', '# Hello')).toBe(true);
  });

  it('returns true for semantically equivalent content with different trailing newlines', () => {
    expect(contentEquals('# Hello', '# Hello\n')).toBe(true);
    expect(contentEquals('# Hello\n', '# Hello')).toBe(true);
    expect(contentEquals('# Hello\n\n', '# Hello')).toBe(true);
  });

  it('returns true for equivalent list markers', () => {
    expect(contentEquals('* item', '- item')).toBe(true);
    expect(contentEquals('+ item', '- item')).toBe(true);
  });

  it('returns false for different content', () => {
    expect(contentEquals('# Hello', '# World')).toBe(false);
    expect(contentEquals('Hello', 'Hello!')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(contentEquals('', '')).toBe(true);
    expect(contentEquals('', '\n')).toBe(true);
    expect(contentEquals('   ', '')).toBe(true);
  });

  it('handles editor round-trip scenario (add character then delete)', () => {
    // Simulates: baseline, user types 'x', user deletes 'x'
    // Editor might serialize with trailing newline even though baseline lacks one
    const baseline = '# Hello';
    const afterRoundTrip = '# Hello\n';

    expect(contentEquals(baseline, afterRoundTrip)).toBe(true);
  });

  it('fast path: returns true without normalization for identical strings', () => {
    // This tests the optimization that skips normalization for identical inputs
    const content = '# Hello\n\nWorld';
    expect(contentEquals(content, content)).toBe(true);
  });
});
