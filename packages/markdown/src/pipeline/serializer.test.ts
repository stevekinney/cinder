/**
 * Unit tests for the Markdown serializer.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 */

import { describe, expect, it } from 'bun:test';
import type { Root } from 'mdast';
import { serialize, serializerOptions } from './serializer.js';

describe('serialize', () => {
  it('serializes a simple paragraph', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Hello world' }],
        },
      ],
    };

    expect(serialize(ast)).toBe('Hello world\n');
  });

  it('serializes headings with ATX style', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 1,
          children: [{ type: 'text', value: 'Title' }],
        },
        {
          type: 'heading',
          depth: 2,
          children: [{ type: 'text', value: 'Subtitle' }],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
    // Should NOT contain setext-style headings
    expect(result).not.toContain('===');
    expect(result).not.toContain('---\n\n');
  });

  it('serializes emphasis with asterisks', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
            { type: 'text', value: ' and ' },
            { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
          ],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('*italic*');
    expect(result).toContain('**bold**');
    // Should NOT use underscores
    expect(result).not.toContain('_italic_');
    expect(result).not.toContain('__bold__');
  });

  it('serializes unordered lists with dashes', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'list',
          ordered: false,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Item 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Item 2' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('- Item 1');
    expect(result).toContain('- Item 2');
    // Should NOT use asterisks or plus signs
    expect(result).not.toMatch(/^\* Item/m);
    expect(result).not.toMatch(/^\+ Item/m);
  });

  it('serializes fenced code blocks with backticks', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'typescript',
          value: 'const x = 1;',
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('```typescript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('```');
    // Should NOT use tildes
    expect(result).not.toContain('~~~');
  });

  it('serializes images to standard markdown image syntax', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'https://example.com/image.png',
              alt: 'Image description',
              title: 'Optional title',
            },
          ],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain(
      '![Image description](https://example.com/image.png "Optional title")',
    );
  });

  it('serializes GFM strikethrough', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'delete', children: [{ type: 'text', value: 'deleted' }] }],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('~~deleted~~');
  });

  it('serializes GFM task lists', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'list',
          ordered: false,
          children: [
            {
              type: 'listItem',
              checked: true,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Done' }],
                },
              ],
            },
            {
              type: 'listItem',
              checked: false,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Todo' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('- [x] Done');
    expect(result).toContain('- [ ] Todo');
  });

  it('serializes GFM tables', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'A' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: 'B' }],
                },
              ],
            },
            {
              type: 'tableRow',
              children: [
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: '1' }],
                },
                {
                  type: 'tableCell',
                  children: [{ type: 'text', value: '2' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = serialize(ast);
    expect(result).toContain('| A | B |');
    expect(result).toContain('| 1 | 2 |');
  });

  it('produces deterministic output for the same AST', () => {
    const ast: Root = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 1,
          children: [{ type: 'text', value: 'Test' }],
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Para with ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'em' }] },
          ],
        },
      ],
    };

    // Serialize multiple times
    const result1 = serialize(ast);
    const result2 = serialize(ast);
    const result3 = serialize(ast);

    // All should be identical
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });
});

describe('serializerOptions', () => {
  it('has expected configuration for determinism', () => {
    expect(serializerOptions.bullet).toBe('-');
    expect(serializerOptions.emphasis).toBe('*');
    expect(serializerOptions.fence).toBe('`');
    expect(serializerOptions.fences).toBe(true);
    expect(serializerOptions.setext).toBe(false);
    expect(serializerOptions.strong).toBe('*');
  });
});
