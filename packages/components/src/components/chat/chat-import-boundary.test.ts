/**
 * Conversationalist boundary regression test for the Chat component.
 *
 * Chat should get transcript types from the published package, while keeping
 * runtime Conversationalist imports isolated to the small bridge modules that
 * intentionally delegate builder/query behavior.
 */

import { describe, expect, it } from 'bun:test';
import ts from 'typescript';

const CHAT_ROOT = import.meta.dir;
const CONVERSATIONALIST_PACKAGE = 'conversationalist';
const CONVERSATIONALIST_MODULE_SPECIFIER_PATTERN =
  /(?:from\s*['"]conversationalist(?:\/[^'"]*)?['"]|import\s*['"]conversationalist(?:\/[^'"]*)?['"]|import\s*\(\s*['"]conversationalist(?:\/[^'"]*)?['"])/;
const RUNTIME_IMPORT_ALLOWLIST = new Set([
  'builders.ts',
  'utilities/conversation.ts',
  'chat-import-boundary.test.ts',
]);

type ModuleSpecifier = {
  specifier: string;
  typeOnly: boolean;
};

function namedImportsAreTypeOnly(namedBindings: ts.NamedImportBindings | undefined): boolean {
  return (
    namedBindings !== undefined &&
    ts.isNamedImports(namedBindings) &&
    namedBindings.elements.length > 0 &&
    namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function importDeclarationIsTypeOnly(node: ts.ImportDeclaration): boolean {
  if (node.importClause?.isTypeOnly) return true;
  if (node.importClause?.name !== undefined) return false;
  return namedImportsAreTypeOnly(node.importClause?.namedBindings);
}

function exportDeclarationIsTypeOnly(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true;
  if (node.exportClause === undefined || !ts.isNamedExports(node.exportClause)) return false;
  return (
    node.exportClause.elements.length > 0 &&
    node.exportClause.elements.every((element) => element.isTypeOnly)
  );
}

/** Collect every static and dynamic import/export module specifier in a source file. */
function collectModuleSpecifiers(filePath: string, source: string): ModuleSpecifier[] {
  const scriptKind = filePath.endsWith('.svelte') ? ts.ScriptKind.TS : undefined;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const specifiers: ModuleSpecifier[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: importDeclarationIsTypeOnly(node),
      });
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push({
        specifier: node.moduleSpecifier.text,
        typeOnly: exportDeclarationIsTypeOnly(node),
      });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const firstArgument = node.arguments[0];
      if (firstArgument && ts.isStringLiteral(firstArgument)) {
        specifiers.push({ specifier: firstArgument.text, typeOnly: false });
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
  it('conversation-model re-exports Conversationalist types without local declarations', async () => {
    const filePath = `${CHAT_ROOT}/conversation-model.ts`;
    const source = await Bun.file(filePath).text();
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
    const specifiers = collectModuleSpecifiers(filePath, source);
    const exportedPackages = specifiers.map(({ specifier }) => specifier);
    const localTypeDeclarations = sourceFile.statements
      .filter(
        (statement) => ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement),
      )
      .map((statement) => statement.name.text);

    expect(exportedPackages).toContain(CONVERSATIONALIST_PACKAGE);
    expect(exportedPackages).toContain(`${CONVERSATIONALIST_PACKAGE}/utilities`);
    expect(exportedPackages).toContain(`${CONVERSATIONALIST_PACKAGE}/markdown`);
    expect(specifiers.every(({ typeOnly }) => typeOnly)).toBe(true);
    expect(localTypeDeclarations).toEqual(['ExportOptions', 'ToMarkdownOptions']);
  });

  it('Conversationalist module-specifier prefilter catches every import form', () => {
    expect(CONVERSATIONALIST_MODULE_SPECIFIER_PATTERN.test("import 'conversationalist';")).toBe(
      true,
    );
    expect(
      CONVERSATIONALIST_MODULE_SPECIFIER_PATTERN.test(
        "import { getMessages } from 'conversationalist/conversation';",
      ),
    ).toBe(true);
    expect(
      CONVERSATIONALIST_MODULE_SPECIFIER_PATTERN.test("await import('conversationalist');"),
    ).toBe(true);
  });

  it('collector recognizes per-specifier type-only imports and exports', () => {
    const specifiers = collectModuleSpecifiers(
      'inline.ts',
      `
        import { type ConversationHistory } from 'conversationalist';
        import { type Message, createConversationHistory } from 'conversationalist/conversation';
        export { type ToolCallPair } from 'conversationalist/utilities';
        export { type MessageInput, appendMessages } from 'conversationalist';
      `,
    );

    expect(specifiers).toEqual([
      { specifier: CONVERSATIONALIST_PACKAGE, typeOnly: true },
      { specifier: `${CONVERSATIONALIST_PACKAGE}/conversation`, typeOnly: false },
      { specifier: `${CONVERSATIONALIST_PACKAGE}/utilities`, typeOnly: true },
      { specifier: CONVERSATIONALIST_PACKAGE, typeOnly: false },
    ]);
  });

  it('runtime Conversationalist imports stay isolated to bridge modules', async () => {
    const glob = new Bun.Glob('**/*.{ts,svelte}');
    const relativePaths = await Array.fromAsync(glob.scan({ cwd: CHAT_ROOT }));
    const checkedPaths = await Promise.all(
      relativePaths.map(async (relativePath) => {
        if (RUNTIME_IMPORT_ALLOWLIST.has(relativePath)) return undefined;
        const filePath = `${CHAT_ROOT}/${relativePath}`;
        const raw = await Bun.file(filePath).text();
        if (!CONVERSATIONALIST_MODULE_SPECIFIER_PATTERN.test(raw)) return undefined;
        const source = filePath.endsWith('.svelte') ? extractSvelteScripts(raw) : raw;
        const runtimeImports = collectModuleSpecifiers(filePath, source).filter(
          ({ specifier, typeOnly }) =>
            !typeOnly &&
            (specifier === CONVERSATIONALIST_PACKAGE ||
              specifier.startsWith(`${CONVERSATIONALIST_PACKAGE}/`)),
        );
        return runtimeImports.length > 0 ? relativePath : undefined;
      }),
    );
    const offenders = checkedPaths.filter(
      (relativePath): relativePath is string => relativePath !== undefined,
    );

    expect(offenders).toEqual([]);
  });
});
