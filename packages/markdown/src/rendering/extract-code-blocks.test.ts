/**
 * Unit tests for extractCodeBlocks.
 *
 * DEP-565: Coverage hardening for @cinder/markdown.
 */

import { describe, expect, it } from 'bun:test';
import type { Code, Root } from 'mdast';
import { extractCodeBlocks } from './extract-code-blocks.js';

/** Create a minimal mdast Root with the given children. */
function createRoot(...children: Root['children']): Root {
  return { type: 'root', children };
}

/** Create a code node. */
function createCodeNode(value: string, options: { lang?: string; meta?: string } = {}): Code {
  return {
    type: 'code',
    value,
    lang: options.lang ?? null,
    meta: options.meta ?? null,
  };
}

describe('extractCodeBlocks', () => {
  it('returns an empty array for an empty AST', () => {
    const root = createRoot();
    expect(extractCodeBlocks(root)).toEqual([]);
  });

  it('returns an empty array when there are no code blocks', () => {
    const root: Root = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'hello' }] }],
    };
    expect(extractCodeBlocks(root)).toEqual([]);
  });

  it('extracts a code block without lang or meta', () => {
    const root = createRoot(createCodeNode('const x = 1;'));
    const result = extractCodeBlocks(root);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      language: null,
      meta: null,
      value: 'const x = 1;',
      index: 0,
    });
  });

  it('extracts a code block with lang but no meta', () => {
    const root = createRoot(createCodeNode('x = 1', { lang: 'python' }));
    const result = extractCodeBlocks(root);
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('python');
    expect(result[0].meta).toBeNull();
  });

  it('extracts a code block with both lang and meta', () => {
    const root = createRoot(
      createCodeNode('const x = 1;', { lang: 'typescript', meta: 'title=example.ts' }),
    );
    const result = extractCodeBlocks(root);
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('typescript');
    expect(result[0].meta).toBe('title=example.ts');
    expect(result[0].value).toBe('const x = 1;');
    expect(result[0].index).toBe(0);
  });

  it('extracts multiple code blocks in document order', () => {
    const root = createRoot(
      createCodeNode('first', { lang: 'js' }),
      createCodeNode('second', { lang: 'python' }),
      createCodeNode('third', { lang: 'rust' }),
    );
    const result = extractCodeBlocks(root);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ language: 'js', meta: null, value: 'first', index: 0 });
    expect(result[1]).toEqual({ language: 'python', meta: null, value: 'second', index: 1 });
    expect(result[2]).toEqual({ language: 'rust', meta: null, value: 'third', index: 2 });
  });

  it('handles a code block with empty value', () => {
    const root = createRoot(createCodeNode('', { lang: 'js' }));
    const result = extractCodeBlocks(root);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('');
  });
});
