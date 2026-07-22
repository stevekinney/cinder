import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

const EDITOR_DEPENDENCY_PATTERN = /(?:^|\/)(?:@codemirror|codemirror|monaco-editor)(?:\/|$)/;

describe('JsonEditor — bundle boundary', () => {
  test('uses the native textarea without a code-editor import edge', async () => {
    const filePath = `${import.meta.dir}/json-editor.svelte`;
    const source = await Bun.file(filePath).text();
    const ast = parse(source, { filename: filePath, modern: true });

    const specifiers: string[] = [];
    for (const program of [ast.instance?.content, ast.module?.content]) {
      for (const statement of program?.body ?? []) {
        if (
          (statement.type === 'ImportDeclaration' || statement.type === 'ExportNamedDeclaration') &&
          statement.source !== null &&
          statement.source !== undefined &&
          typeof statement.source.value === 'string'
        ) {
          specifiers.push(statement.source.value);
        }
      }
    }

    expect(source).toContain('<textarea');
    expect(specifiers.filter((specifier) => EDITOR_DEPENDENCY_PATTERN.test(specifier))).toEqual([]);
  });
});
