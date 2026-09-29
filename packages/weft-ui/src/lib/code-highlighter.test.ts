import { describe, expect, test } from 'bun:test';

import { codeHighlighter } from './code-highlighter.ts';

describe('codeHighlighter', () => {
  test('loads the curated TypeScript and JSON grammars with the dual theme pair', async () => {
    const typescript = await codeHighlighter('const answer: number = 42;', 'typescript');
    const json = await codeHighlighter('{"answer":42}', 'json');

    expect(typescript).toContain('shiki');
    expect(typescript).toContain('<span');
    expect(json).toContain('shiki');
    expect(json).toContain('<span');
  });
});
