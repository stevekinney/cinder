import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import ts from 'typescript';

const sourceRoot = join(import.meta.dir, '..');

describe('stable component context keys', () => {
  test('each provider family has a distinct global key', async () => {
    const uses: Array<{ key: string; path: string }> = [];
    for await (const path of new Bun.Glob('**/*.ts').scan({ cwd: sourceRoot, absolute: true })) {
      const source = ts.createSourceFile(
        path,
        await readFile(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node): void {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'strictStableContext'
        ) {
          const key = node.arguments[0];
          expect(key !== undefined && ts.isStringLiteral(key)).toBe(true);
          if (key && ts.isStringLiteral(key)) {
            uses.push({ key: key.text, path: relative(sourceRoot, path) });
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }

    expect(uses.length).toBeGreaterThan(1);
    const duplicates = uses.filter(
      (use, index) => uses.findIndex((other) => other.key === use.key) !== index,
    );
    expect(duplicates).toEqual([]);
  });
});
