/**
 * Import-boundary regression test for the Chat component.
 *
 * Chat vendors its own conversation data model (`conversation-model.ts`) and
 * cinder-owned runtime helpers so it depends on NO external conversation-state
 * library. This test fails if any file under `chat/` reintroduces an import of
 * `conversationalist` (static `import ... from`, `export ... from`, or dynamic
 * `import('conversationalist')`), which would recreate the dependency this work
 * removed.
 *
 * The check parses each source with the TypeScript compiler API so it inspects
 * real module specifiers — comments and string literals that merely mention the
 * package (e.g. provenance notes) do not trip it.
 */

import { Glob } from 'bun';
import { describe, expect, it } from 'bun:test';
import ts from 'typescript';

const FORBIDDEN_PACKAGE = 'conversationalist';
const CHAT_ROOT = import.meta.dir;

/** Collect every static and dynamic import/export module specifier in a source file. */
function collectModuleSpecifiers(filePath: string, source: string): string[] {
  const scriptKind = filePath.endsWith('.svelte') ? ts.ScriptKind.TS : undefined;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
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
      const firstArgument = node.arguments[0];
      if (firstArgument && ts.isStringLiteral(firstArgument)) {
        specifiers.push(firstArgument.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

/** Extracts `<script>` contents from a `.svelte` file (where imports live). */
function extractSvelteScripts(source: string): string {
  const scriptBlocks = source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
  return Array.from(scriptBlocks, (match) => match[1] ?? '').join('\n');
}

describe('chat import boundary', () => {
  it('no file under chat/ imports conversationalist', async () => {
    const glob = new Glob('**/*.{ts,svelte}');
    const offenders: string[] = [];

    for await (const relativePath of glob.scan({ cwd: CHAT_ROOT })) {
      const filePath = `${CHAT_ROOT}/${relativePath}`;
      const raw = await Bun.file(filePath).text();
      const source = filePath.endsWith('.svelte') ? extractSvelteScripts(raw) : raw;
      const specifiers = collectModuleSpecifiers(filePath, source);
      if (
        specifiers.some(
          (specifier) =>
            specifier === FORBIDDEN_PACKAGE || specifier.startsWith(`${FORBIDDEN_PACKAGE}/`),
        )
      ) {
        offenders.push(relativePath);
      }
    }

    expect(
      offenders,
      `chat/ files must not import '${FORBIDDEN_PACKAGE}': ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
