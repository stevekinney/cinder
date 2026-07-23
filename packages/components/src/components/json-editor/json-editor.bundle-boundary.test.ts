import { dirname, extname, resolve as resolvePath } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

const EDITOR_DEPENDENCY_PATTERN = /(?:^|\/)(?:@codemirror|codemirror|monaco-editor)(?:\/|$)/;

function collectEstreeSpecifiers(node: unknown, specifiers: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectEstreeSpecifiers(child, specifiers);
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

  for (const child of Object.values(record)) collectEstreeSpecifiers(child, specifiers);
}

function typescriptSpecifiers(filePath: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function moduleSpecifiers(filePath: string, source: string): string[] {
  if (filePath.endsWith('.svelte')) {
    const ast = parse(source, { filename: filePath, modern: true });
    const specifiers: string[] = [];
    for (const program of [ast.instance?.content, ast.module?.content]) {
      collectEstreeSpecifiers(program, specifiers);
    }
    return specifiers;
  }
  if (filePath.endsWith('.css')) {
    return [...source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)].map(
      (match) => match[1] as string,
    );
  }
  return typescriptSpecifiers(filePath, source);
}

async function resolveLocalSpecifier(fromFile: string, specifier: string): Promise<string> {
  const base = resolvePath(dirname(fromFile), specifier);
  const candidates = extname(base)
    ? [base]
    : [base, `${base}.ts`, `${base}.svelte`, `${base}.css`, resolvePath(base, 'index.ts')];
  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) return candidate;
  }
  throw new Error(`Could not resolve '${specifier}' from ${fromFile}`);
}

async function publicEntryImportClosure(entryPath: string): Promise<{
  files: string[];
  forbiddenEdges: string[];
}> {
  const pending = [entryPath];
  const files = new Set<string>();
  const forbiddenEdges: string[] = [];

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (filePath === undefined || files.has(filePath)) continue;
    files.add(filePath);

    const source = await Bun.file(filePath).text();
    for (const specifier of moduleSpecifiers(filePath, source)) {
      if (EDITOR_DEPENDENCY_PATTERN.test(specifier)) {
        forbiddenEdges.push(`${filePath}: ${specifier}`);
      }
      if (specifier.startsWith('.')) {
        pending.push(await resolveLocalSpecifier(filePath, specifier));
      }
    }
  }

  return { files: [...files], forbiddenEdges };
}

describe('JsonEditor — bundle boundary', () => {
  test('public entry uses the native textarea without a code-editor import edge', async () => {
    const entryPath = resolvePath(import.meta.dir, 'index.ts');
    const componentPath = resolvePath(import.meta.dir, 'json-editor.svelte');
    const closure = await publicEntryImportClosure(entryPath);

    expect(closure.files).toContain(entryPath);
    expect(closure.files).toContain(componentPath);
    expect(await Bun.file(componentPath).text()).toContain('<textarea');
    expect(closure.forbiddenEdges).toEqual([]);
  });
});
