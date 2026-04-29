/**
 * Round-trip integration tests for the Markdown pipeline.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * These tests verify that: parse(serialize(parse(markdown))) produces
 * an AST semantically equivalent to parse(markdown).
 *
 * This is the key property for deterministic serialization - content
 * must survive the round-trip without loss of semantic meaning.
 */

import { describe, expect, it } from 'bun:test';
import { roundTrip } from './pipeline/index.js';

/**
 * Test cases organized by Markdown feature.
 * Each case has a name and input Markdown string.
 */
const roundTripCases = [
  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Content
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'empty document', input: '' },
  { name: 'single paragraph', input: 'Hello world' },
  {
    name: 'multiple paragraphs',
    input: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
  },
  { name: 'paragraph with line break', input: 'Line one.\nLine two.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Headings (ATX style)
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'heading level 1', input: '# Heading 1' },
  { name: 'heading level 2', input: '## Heading 2' },
  { name: 'heading level 3', input: '### Heading 3' },
  { name: 'heading level 4', input: '#### Heading 4' },
  { name: 'heading level 5', input: '##### Heading 5' },
  { name: 'heading level 6', input: '###### Heading 6' },
  { name: 'multiple headings', input: '# H1\n\n## H2\n\n### H3' },
  { name: 'heading with inline formatting', input: '# Hello *italic* and **bold**' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Emphasis and Strong
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'emphasis with asterisks', input: '*italic text*' },
  { name: 'strong with asterisks', input: '**bold text**' },
  { name: 'nested emphasis', input: '***bold and italic***' },
  { name: 'emphasis in paragraph', input: 'This is *emphasized* text.' },
  { name: 'strong in paragraph', input: 'This is **strong** text.' },
  { name: 'mixed emphasis', input: '*italic* and **bold** together' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GFM Strikethrough
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'strikethrough', input: '~~deleted text~~' },
  { name: 'strikethrough in paragraph', input: 'This is ~~deleted~~ text.' },
  { name: 'strikethrough with emphasis', input: '~~*deleted italic*~~' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Code
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'inline code', input: 'Use `const` for constants' },
  { name: 'inline code with backticks', input: '`` `backticks` inside ``' },
  { name: 'fenced code block', input: '```\ncode here\n```' },
  { name: 'fenced code with language', input: '```javascript\nconst x = 1;\n```' },
  { name: 'fenced code typescript', input: '```typescript\nconst x: number = 1;\n```' },
  { name: 'fenced code python', input: '```python\ndef hello():\n    print("Hello")\n```' },
  {
    name: 'fenced code multiline',
    input: '```js\nconst a = 1;\nconst b = 2;\nconst c = a + b;\n```',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Lists
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'unordered list simple', input: '- Item 1\n- Item 2\n- Item 3' },
  { name: 'ordered list simple', input: '1. First\n2. Second\n3. Third' },
  { name: 'nested unordered list', input: '- Parent\n  - Child\n    - Grandchild' },
  {
    name: 'nested ordered list',
    input: '1. First\n   1. Nested first\n   2. Nested second\n2. Second',
  },
  {
    name: 'mixed nested list',
    input: '1. Ordered\n   - Unordered child\n   - Another child\n2. Second ordered',
  },
  { name: 'list with paragraphs', input: '- Item 1\n\n  Continuation paragraph.\n\n- Item 2' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GFM Task Lists
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'task list checked', input: '- [x] Done task' },
  { name: 'task list unchecked', input: '- [ ] Todo task' },
  { name: 'task list mixed', input: '- [x] Done\n- [ ] Todo\n- [x] Also done' },
  {
    name: 'nested task list',
    input: '- [ ] Parent task\n  - [x] Child task done\n  - [ ] Child task todo',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Links
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'inline link', input: '[Example](https://example.com)' },
  { name: 'inline link with title', input: '[Example](https://example.com "Example Site")' },
  { name: 'link in paragraph', input: 'Visit [our site](https://example.com) for more.' },
  { name: 'multiple links', input: '[Link 1](https://one.com) and [Link 2](https://two.com)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Images
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'image basic', input: '![Alt text](image.png)' },
  { name: 'image with title', input: '![Alt text](image.png "Image title")' },
  { name: 'image in paragraph', input: 'Here is an image: ![logo](logo.svg)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Blockquotes
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'simple blockquote', input: '> Quote text' },
  { name: 'multiline blockquote', input: '> Line 1\n> Line 2\n> Line 3' },
  { name: 'nested blockquote', input: '> Outer quote\n>\n>> Inner quote' },
  { name: 'blockquote with formatting', input: '> **Important:** This is *emphasized*.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // GFM Tables
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'simple table', input: '| A | B |\n|---|---|\n| 1 | 2 |' },
  { name: 'table with headers', input: '| Name | Value |\n|------|-------|\n| foo  | bar   |' },
  {
    name: 'table with alignment',
    input: '| Left | Center | Right |\n|:-----|:------:|------:|\n| L    | C      | R     |',
  },
  {
    name: 'table multiple rows',
    input: '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n| 7 | 8 | 9 |',
  },
  {
    name: 'table with inline formatting',
    input: '| Feature | Status |\n|---------|--------|\n| *Bold* | **Yes** |',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Thematic Breaks
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'thematic break dashes', input: 'Above\n\n---\n\nBelow' },
  { name: 'multiple thematic breaks', input: 'Part 1\n\n---\n\nPart 2\n\n---\n\nPart 3' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Special Characters and Escaping
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'escaped asterisks', input: '\\*not italic\\*' },
  { name: 'escaped brackets', input: '\\[not a link\\]' },
  { name: 'literal backslash', input: 'A backslash: \\\\' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Unicode and International
  // ═══════════════════════════════════════════════════════════════════════════
  { name: 'unicode characters', input: 'Hello 世界 🌍' },
  { name: 'unicode in heading', input: '# Héllo Wörld' },
  { name: 'emoji paragraph', input: 'Status: ✅ Complete 🎉' },
  { name: 'mixed scripts', input: 'English, 日本語, العربية, עברית' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Complex Mixed Content
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'heading with paragraph',
    input: '# Title\n\nThis is the first paragraph.',
  },
  {
    name: 'document structure',
    input:
      '# Main Title\n\nIntro paragraph.\n\n## Section 1\n\nSection content.\n\n## Section 2\n\nMore content.',
  },
  {
    name: 'list after paragraph',
    input: 'Here are items:\n\n- Item 1\n- Item 2\n- Item 3',
  },
  {
    name: 'code after heading',
    input: '## Example\n\n```js\nconst x = 1;\n```',
  },
  {
    name: 'table with surrounding text',
    input: 'Data table:\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nEnd of table.',
  },
  {
    name: 'complex document',
    input: `# Document Title

This is the introduction with *emphasis* and **strong** text.

## Features

- Feature one
- Feature two with \`code\`
- Feature three

## Code Example

\`\`\`typescript
const greeting = "Hello";
console.log(greeting);
\`\`\`

## Data

| Name | Value |
|------|-------|
| foo  | 1     |
| bar  | 2     |

> Note: This is important.

---

The end.`,
  },
];

describe('round-trip integration', () => {
  describe.each(roundTripCases)('$name', ({ input }) => {
    it('preserves semantic equivalence', () => {
      const result = roundTrip(input);
      expect(result.passes).toBe(true);
    });

    it('produces serialized output', () => {
      const result = roundTrip(input);
      expect(typeof result.serialized).toBe('string');
    });
  });
});

describe('round-trip edge cases', () => {
  it('handles extremely long paragraphs', () => {
    const longText = 'A'.repeat(10000);
    const result = roundTrip(longText);
    expect(result.passes).toBe(true);
  });

  it('handles deeply nested lists', () => {
    const nestedList = `- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5`;
    const result = roundTrip(nestedList);
    expect(result.passes).toBe(true);
  });

  it('handles many consecutive headings', () => {
    const headings = Array.from({ length: 20 }, (_, i) => `## Heading ${i + 1}`).join('\n\n');
    const result = roundTrip(headings);
    expect(result.passes).toBe(true);
  });

  it('handles large table', () => {
    const header = '| ' + Array.from({ length: 10 }, (_, i) => `Col${i}`).join(' | ') + ' |';
    const separator = '|' + Array.from({ length: 10 }, () => '---').join('|') + '|';
    const rows = Array.from(
      { length: 50 },
      (_, r) => '| ' + Array.from({ length: 10 }, (_, c) => `R${r}C${c}`).join(' | ') + ' |',
    );
    const table = [header, separator, ...rows].join('\n');
    const result = roundTrip(table);
    expect(result.passes).toBe(true);
  });

  it('handles mixed whitespace', () => {
    const mixed = '# Title\n\n\n\nParagraph with   multiple   spaces.\n\n\n\n## Next';
    const result = roundTrip(mixed);
    expect(result.passes).toBe(true);
  });
});
