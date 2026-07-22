import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

const EDITOR_DEPENDENCY_PATTERN = /(?:^|\/)(?:@codemirror|codemirror|monaco-editor)(?:\/|$)/;

function collectModuleSpecifiers(node: unknown, specifiers: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectModuleSpecifiers(child, specifiers);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const record = node as Record<string, unknown>;
  const type = record['type'];
  if (
    type === 'ImportDeclaration' ||
    type === 'ExportNamedDeclaration' ||
    type === 'ExportAllDeclaration' ||
    type === 'ImportExpression'
  ) {
    const source = record['source'];
    if (source !== null && typeof source === 'object') {
      const value = (source as Record<string, unknown>)['value'];
      if (typeof value === 'string') specifiers.push(value);
    }
  }

  for (const child of Object.values(record)) collectModuleSpecifiers(child, specifiers);
}

describe('JsonEditor — bundle boundary', () => {
  test('uses the native textarea without a code-editor import edge', async () => {
    const filePath = `${import.meta.dir}/json-editor.svelte`;
    const source = await Bun.file(filePath).text();
    const ast = parse(source, { filename: filePath, modern: true });

    const specifiers: string[] = [];
    for (const program of [ast.instance?.content, ast.module?.content]) {
      collectModuleSpecifiers(program, specifiers);
    }

    expect(source).toContain('<textarea');
    expect(specifiers.filter((specifier) => EDITOR_DEPENDENCY_PATTERN.test(specifier))).toEqual([]);
  });
});
