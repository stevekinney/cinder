import { describe, expect, it } from 'bun:test';
import ts from 'typescript';
import {
  childNodes,
  isNode,
  nodeField,
  parseSvelte,
  scriptStatements,
  type AstNode,
} from '../../test/svelte-ast.ts';

const PROTECTED_PREFIXES = ['@milkdown/', 'prosemirror-'] as const;

function isProtected(specifier: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

type DynamicImportInfo = {
  specifier: string | null;
  guardedByEarlyReturn: boolean;
};

function isEarlyBrowserReturnGuard(statement: unknown): boolean {
  if (!isNode(statement) || statement.type !== 'IfStatement') return false;
  const test = nodeField(statement, 'test');
  return (
    isBrowserNegation(test) &&
    isBareReturn(nodeField(statement, 'consequent')) &&
    hasNoAlternate(statement)
  );
}

function isBrowserNegation(node: unknown): boolean {
  if (!isNode(node) || node.type !== 'UnaryExpression' || nodeField(node, 'operator') !== '!')
    return false;
  const argument = nodeField(node, 'argument');
  return (
    isNode(argument) && argument.type === 'Identifier' && nodeField(argument, 'name') === 'browser'
  );
}

function isBareReturn(node: unknown): boolean {
  return isNode(node) && node.type === 'ReturnStatement';
}

function hasNoAlternate(node: AstNode): boolean {
  const alternate = nodeField(node, 'alternate');
  return alternate === undefined || alternate === null;
}

function findDynamicImports(node: AstNode, dominatedByGuard: boolean): DynamicImportInfo[] {
  if (node.type === 'ImportExpression') {
    const source = nodeField(node, 'source');
    const value = isNode(source) && source.type === 'Literal' ? nodeField(source, 'value') : null;
    const specifier = typeof value === 'string' ? value : null;
    return [{ specifier, guardedByEarlyReturn: dominatedByGuard }];
  }

  if (node.type === 'ArrowFunctionExpression') {
    return findDynamicImportsInArrow(node);
  }

  return childNodes(node).flatMap((child) => findDynamicImports(child, dominatedByGuard));
}

function findDynamicImportsInArrow(node: AstNode): DynamicImportInfo[] {
  const body = nodeField(node, 'body');
  if (!isNode(body)) return [];
  if (body.type !== 'BlockStatement') return findDynamicImports(body, false);
  const statements = nodeField(body, 'body');
  const list = Array.isArray(statements) ? statements.filter(isNode) : [];
  const guarded = list[0] !== undefined && isEarlyBrowserReturnGuard(list[0]);
  return list.flatMap((statement) => findDynamicImports(statement, guarded));
}

function collectViolations(statements: readonly AstNode[]): {
  staticValueViolations: string[];
  unguardedDynamicViolations: string[];
  nonLiteralDynamicViolations: string[];
} {
  const staticValueViolations: string[] = [];
  const unguardedDynamicViolations: string[] = [];
  const nonLiteralDynamicViolations: string[] = [];

  for (const statement of statements) {
    const staticImport = staticProtectedImport(statement);
    if (staticImport) staticValueViolations.push(staticImport);
    const dynamic = findDynamicImports(statement, false);
    for (const violation of classifyDynamicImports(dynamic)) {
      if (violation.kind === 'non-literal') nonLiteralDynamicViolations.push(violation.value);
      if (violation.kind === 'unguarded') unguardedDynamicViolations.push(violation.value);
    }
  }

  return { staticValueViolations, unguardedDynamicViolations, nonLiteralDynamicViolations };
}

function staticProtectedImport(statement: AstNode): string | null {
  if (statement.type !== 'ImportDeclaration' || nodeField(statement, 'importKind') === 'type')
    return null;
  const source = nodeField(statement, 'source');
  const specifier = isNode(source) ? nodeField(source, 'value') : undefined;
  return typeof specifier === 'string' && isProtected(specifier) ? specifier : null;
}

type DynamicViolation = { kind: 'non-literal' | 'unguarded'; value: string };

function classifyDynamicImports(imports: readonly DynamicImportInfo[]): DynamicViolation[] {
  const violations: DynamicViolation[] = [];
  for (const { specifier, guardedByEarlyReturn } of imports) {
    if (specifier === null) {
      violations.push({ kind: 'non-literal', value: '<non-literal specifier>' });
    } else if (isProtected(specifier) && !guardedByEarlyReturn) {
      violations.push({ kind: 'unguarded', value: specifier });
    }
  }
  return violations;
}

const SOURCE_PATH = new URL('./markdown-editor.svelte', import.meta.url).pathname;
const source = await Bun.file(SOURCE_PATH)
  .text()
  .catch(() => {
    throw new Error(`[import-boundary] Cannot read ${SOURCE_PATH} — failing hard per plan`);
  });
const svelteAst = parseSvelte(source, SOURCE_PATH);
const instanceBody = scriptStatements(svelteAst, 'instance');
const moduleBody = scriptStatements(svelteAst, 'module');
const { staticValueViolations, unguardedDynamicViolations, nonLiteralDynamicViolations } =
  collectViolations([...moduleBody, ...instanceBody]);

function analyzeFixture(svelteSource: string): ReturnType<typeof collectViolations> {
  const ast = parseSvelte(svelteSource, 'fixture.svelte');
  return collectViolations(scriptStatements(ast, 'instance'));
}

describe('MarkdownEditor import-boundary invariant', () => {
  it('has no static value imports from @milkdown/ or prosemirror-', () => {
    expect(staticValueViolations).toEqual([]);
  });

  it('has no unguarded dynamic imports of @milkdown/ or prosemirror-', () => {
    expect(unguardedDynamicViolations).toEqual([]);
  });

  it('has no non-literal dynamic import specifiers in the script', () => {
    expect(nonLiteralDynamicViolations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Permanent synthetic fixtures — prove the matcher is fail-closed
// These MUST stay in the test; they are the regression coverage for the
// matcher itself, not for the component.
// ---------------------------------------------------------------------------

describe('import-boundary matcher fixtures (fail-closed regression coverage)', () => {
  it('FAILS: static value import from protected package', () => {
    const result = analyzeFixture(
      `<script lang="ts">import { foo } from '@milkdown/kit/ctx';</script><div></div>`,
    );
    expect(result.staticValueViolations).toEqual(['@milkdown/kit/ctx']);
  });

  it('PASSES: type-only import from protected package', () => {
    const result = analyzeFixture(
      `<script lang="ts">import type { Ctx } from '@milkdown/kit/ctx';</script><div></div>`,
    );
    expect(result.staticValueViolations).toEqual([]);
  });

  it('PASSES: guarded dynamic import (early-return domination)', () => {
    const result = analyzeFixture(
      `<script lang="ts">
        $effect(() => {
          if (!browser) return;
          void import('@milkdown/kit/prose/history').then(m => {});
        });
      </script><div></div>`,
    );
    expect(result.unguardedDynamicViolations).toEqual([]);
  });

  it('FAILS: unguarded dynamic import of protected package at top level', () => {
    const result = analyzeFixture(
      `<script lang="ts">
        void import('@milkdown/kit/prose/history').then(m => {});
      </script><div></div>`,
    );
    expect(result.unguardedDynamicViolations).toEqual(['@milkdown/kit/prose/history']);
  });

  it('FAILS: unguarded dynamic import of protected package inside effect (no guard)', () => {
    const result = analyzeFixture(
      `<script lang="ts">
        $effect(() => {
          void import('@milkdown/kit/prose/history').then(m => {});
        });
      </script><div></div>`,
    );
    expect(result.unguardedDynamicViolations).toEqual(['@milkdown/kit/prose/history']);
  });

  it('FAILS: non-literal specifier in dynamic import', () => {
    const result = analyzeFixture(
      `<script lang="ts">
        const pkg = '@milkdown/kit/prose/history';
        $effect(() => {
          if (!browser) return;
          void import(pkg).then(m => {});
        });
      </script><div></div>`,
    );
    expect(result.nonLiteralDynamicViolations).toEqual(['<non-literal specifier>']);
  });

  it('PASSES: dynamic import of a safe (non-protected) package', () => {
    const result = analyzeFixture(
      `<script lang="ts">
        void import('some-safe-package').then(m => {});
      </script><div></div>`,
    );
    expect(result.unguardedDynamicViolations).toEqual([]);
    expect(result.staticValueViolations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// COR-525: preview and mode modules
//
// Preview must not initialize Milkdown on a preview-only mount. This guards
// what COR-525 could: the new modules add no static Milkdown or ProseMirror
// import anywhere in their own local graph, and the component's history import
// waits for a rich editor to exist. The component's whole graph, which COR-525
// left out of scope, is walked by the COR-1322 section below.
// ---------------------------------------------------------------------------

const COR_525_MODULES = [
  './markdown-editor-mode.ts',
  './markdown-editor-mode-controller.svelte.ts',
  './markdown-editor-mode-control.svelte',
  './markdown-editor-preview.svelte',
  './markdown-editor-preview.svelte.ts',
  './markdown-editor-toolbar-context.ts',
] as const;

/** Parse a `.svelte` file, or a TypeScript module as the instance script of one. */
async function moduleStatements(path: string): Promise<AstNode[]> {
  const text = await Bun.file(path).text();
  if (path.endsWith('.svelte')) {
    const root = parseSvelte(text, path);
    return [...scriptStatements(root, 'module'), ...scriptStatements(root, 'instance')];
  }
  return scriptStatements(parseSvelte(`<script lang="ts">${text}</script>`, path), 'instance');
}

/** Static imports that load code: not `import type`, and not all-`type` specifiers. */
function staticValueSpecifiers(statements: readonly AstNode[]): string[] {
  const specifiers: string[] = [];
  for (const statement of statements) {
    if (statement.type !== 'ImportDeclaration' || nodeField(statement, 'importKind') === 'type') {
      continue;
    }
    const imported = nodeField(statement, 'specifiers');
    const list = Array.isArray(imported) ? imported.filter(isNode) : [];
    if (list.length > 0 && list.every((node) => nodeField(node, 'importKind') === 'type')) continue;
    const source = nodeField(statement, 'source');
    const value = isNode(source) ? nodeField(source, 'value') : undefined;
    if (typeof value === 'string') specifiers.push(value);
  }
  return specifiers;
}

/** Resolve a `.js` specifier to the `.ts` source it names, as the TypeScript build does. */
async function resolveLocalModule(path: string): Promise<string> {
  if (path.endsWith('.js') && !(await Bun.file(path).exists())) return `${path.slice(0, -3)}.ts`;
  return path;
}

/** Every package specifier statically reachable from `entries` through local files. */
async function reachablePackages(entries: readonly string[]): Promise<Map<string, string>> {
  const reached = new Map<string, string>();
  const seen = new Set<string>();
  const queue = entries.map((entry) => new URL(entry, import.meta.url).pathname);
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (seen.has(path) || path.endsWith('.css')) continue;
    seen.add(path);
    for (const specifier of staticValueSpecifiers(await moduleStatements(path))) {
      if (specifier.startsWith('.')) {
        queue.push(await resolveLocalModule(new URL(specifier, `file://${path}`).pathname));
      } else if (!reached.has(specifier)) {
        reached.set(specifier, path);
      }
    }
  }
  return reached;
}

/** Identifiers tested by the leading early-return guards of the arrow that dynamically imports `specifier`. */
function guardIdentifiersFor(statements: readonly AstNode[], specifier: string): string[] | null {
  for (const statement of statements) {
    const found = findGuardedImport(statement, specifier);
    if (found) return found;
  }
  return null;
}

function containsImportOf(node: AstNode, specifier: string): boolean {
  if (node.type === 'ImportExpression') {
    const source = nodeField(node, 'source');
    return isNode(source) && nodeField(source, 'value') === specifier;
  }
  return childNodes(node).some((child) => containsImportOf(child, specifier));
}

function identifierNames(node: AstNode): string[] {
  if (node.type === 'Identifier') return [String(nodeField(node, 'name'))];
  return childNodes(node).flatMap(identifierNames);
}

function findGuardedImport(node: AstNode, specifier: string): string[] | null {
  if (node.type === 'ArrowFunctionExpression') {
    const body = nodeField(node, 'body');
    const statements = isNode(body) ? nodeField(body, 'body') : undefined;
    if (Array.isArray(statements) && containsImportOf(node, specifier)) {
      const guards: string[] = [];
      for (const statement of statements.filter(isNode)) {
        const consequent = nodeField(statement, 'consequent');
        const test = nodeField(statement, 'test');
        if (statement.type !== 'IfStatement' || !isBareReturn(consequent) || !isNode(test)) break;
        guards.push(...identifierNames(test));
      }
      const nested = statements.filter(isNode).flatMap((child) => {
        const inner = findGuardedImport(child, specifier);
        return inner ? [inner] : [];
      });
      return nested[0] ?? guards;
    }
  }
  for (const child of childNodes(node)) {
    const found = findGuardedImport(child, specifier);
    if (found) return found;
  }
  return null;
}

describe('MarkdownEditor import boundary for preview and mode modules (COR-525)', () => {
  it.each([...COR_525_MODULES])('%s has no static or unguarded protected import', async (path) => {
    const result = collectViolations(
      await moduleStatements(new URL(path, import.meta.url).pathname),
    );
    expect(result).toEqual({
      staticValueViolations: [],
      unguardedDynamicViolations: [],
      nonLiteralDynamicViolations: [],
    });
  });

  it('their local static graph reaches no @milkdown/ or prosemirror- package', async () => {
    const reached = await reachablePackages(COR_525_MODULES);
    const protectedReached = [...reached].filter(([specifier]) => isProtected(specifier));
    expect(protectedReached).toEqual([]);
    // The walk really follows local files: the preview module reaches the
    // Markdown package through the editor's configuration module.
    expect(reached.has('@lostgradient/markdown')).toBe(true);
  });

  it('loads Milkdown history only once a rich editor exists', () => {
    const guards = guardIdentifiersFor(instanceBody, '@milkdown/kit/prose/history');
    expect(guards).toContain('browser');
    expect(guards).toContain('editorState');
  });

  it('matcher: a history import guarded only by `browser` is reported as such', () => {
    const fixture = parseSvelte(
      `<script lang="ts">
        $effect(() => {
          if (!browser) return;
          void import('@milkdown/kit/prose/history');
        });
      </script>`,
      'fixture.svelte',
    );
    const guards = guardIdentifiersFor(
      scriptStatements(fixture, 'instance'),
      '@milkdown/kit/prose/history',
    );
    expect(guards).toEqual(['browser']);
  });

  it('matcher: a static Milkdown import in a local dependency is found', async () => {
    const reached = await reachablePackages(['../../editor/editor.ts']);
    expect([...reached.keys()].some(isProtected)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// COR-1322: the component's whole static import graph
//
// Importing `MarkdownEditor` must evaluate no Milkdown or ProseMirror module.
// This walk starts at `markdown-editor.svelte` and follows every static
// runtime import and re-export (`import … from`, `export … from`,
// `export * from`) through local `.ts`, `.svelte` and `.svelte.ts` files to
// their leaves, including the `editor/index.ts` and `attach.ts` edges that
// COR-525 left out of scope. `import type`, `export type` and all-`type`
// specifier lists are erased and skipped. Dynamic `import()` expressions are
// leaves the walk does not follow; the guard rules above check them.
// ---------------------------------------------------------------------------

function isTypeOnlyDeclaration(statement: AstNode): boolean {
  const kindField = statement.type === 'ImportDeclaration' ? 'importKind' : 'exportKind';
  if (nodeField(statement, kindField) === 'type') return true;
  const named = nodeField(statement, 'specifiers');
  const list = Array.isArray(named) ? named.filter(isNode) : [];
  return list.length > 0 && list.every((node) => nodeField(node, kindField) === 'type');
}

const MODULE_EDGE_TYPES = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportAllDeclaration',
]);

/** Specifiers of static imports and re-exports that load code at runtime. */
function staticRuntimeSpecifiers(statements: readonly AstNode[]): string[] {
  const specifiers: string[] = [];
  for (const statement of statements) {
    if (!MODULE_EDGE_TYPES.has(statement.type) || isTypeOnlyDeclaration(statement)) continue;
    const source = nodeField(statement, 'source');
    const value = isNode(source) ? nodeField(source, 'value') : undefined;
    if (typeof value === 'string') specifiers.push(value);
  }
  return specifiers;
}

function typeScriptDeclarationIsTypeOnly(
  statement: ts.ImportDeclaration | ts.ExportDeclaration,
): boolean {
  if (ts.isExportDeclaration(statement)) {
    if (statement.isTypeOnly) return true;
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) return false;
    return clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly);
  }
  const clause = statement.importClause;
  if (clause === undefined) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name !== undefined) return false;
  const bindings = clause.namedBindings;
  if (bindings === undefined || !ts.isNamedImports(bindings)) return false;
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

/**
 * Static runtime specifiers of a TypeScript module. Module-level imports and
 * re-exports are always top-level statements, so a parse of the file's
 * statements is complete; the TypeScript parser handles any source text,
 * including JSDoc that a Svelte script wrapper would misread.
 */
function typeScriptRuntimeSpecifiers(path: string, text: string): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const source = statement.moduleSpecifier;
    if (source === undefined || !ts.isStringLiteral(source)) continue;
    if (!typeScriptDeclarationIsTypeOnly(statement)) specifiers.push(source.text);
  }
  return specifiers;
}

/** Static runtime specifiers of a module: `.svelte` through the Svelte AST, anything else as TypeScript. */
function moduleRuntimeSpecifiers(path: string, text: string): string[] {
  if (!path.endsWith('.svelte')) return typeScriptRuntimeSpecifiers(path, text);
  const root = parseSvelte(text, path);
  return staticRuntimeSpecifiers([
    ...scriptStatements(root, 'module'),
    ...scriptStatements(root, 'instance'),
  ]);
}

/** Reads a module's source, or returns `null` when no such module exists. */
type ModuleReader = (path: string) => Promise<string | null>;

const readFromDisk: ModuleReader = async (path) => {
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : null;
};

/** Resolve a relative specifier to a readable local module, mapping `.js` to `.ts`. */
async function resolveLocal(
  from: string,
  specifier: string,
  read: ModuleReader,
): Promise<string | null> {
  const path = new URL(specifier, `file://${from}`).pathname;
  if (path.endsWith('.css')) return null;
  const candidates = path.endsWith('.js') ? [path, `${path.slice(0, -3)}.ts`] : [path];
  for (const candidate of candidates) {
    if ((await read(candidate)) !== null) return candidate;
  }
  throw new Error(`[import-boundary] Cannot resolve ${specifier} from ${from} — failing hard`);
}

/** Every protected package statically reachable from `entry`, with the chain of modules that reaches it. */
async function protectedChainsFrom(
  entry: string,
  read: ModuleReader = readFromDisk,
): Promise<string[][]> {
  const parents = new Map<string, string | null>([[entry, null]]);
  const chainTo = (path: string): string[] => {
    const chain: string[] = [];
    for (let at: string | null = path; at !== null; at = parents.get(at) ?? null) chain.unshift(at);
    return chain;
  };
  const queue = [entry];
  const chains: string[][] = [];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const text = await read(path);
    if (text === null) throw new Error(`[import-boundary] Cannot read ${path} — failing hard`);
    for (const specifier of moduleRuntimeSpecifiers(path, text)) {
      if (isProtected(specifier)) chains.push([...chainTo(path), specifier]);
      if (!specifier.startsWith('.')) continue;
      const resolved = await resolveLocal(path, specifier, read);
      if (resolved === null || parents.has(resolved)) continue;
      parents.set(resolved, path);
      queue.push(resolved);
    }
  }
  return chains;
}

const LIBRARY_ROOT = new URL('../../', import.meta.url).pathname;

function describeChain(chain: readonly string[]): string {
  return chain.map((link) => link.replace(LIBRARY_ROOT, '')).join(' -> ');
}

/** Follows every static local edge reachable from `entry`, returning each module visited. */
async function reachableLocalModules(entry: string): Promise<Set<string>> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const text = await readFromDisk(path);
    if (text === null) throw new Error(`[import-boundary] Cannot read ${path} — failing hard`);
    for (const specifier of moduleRuntimeSpecifiers(path, text)) {
      if (!specifier.startsWith('.')) continue;
      const resolved = await resolveLocal(path, specifier, readFromDisk);
      if (resolved === null || seen.has(resolved)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return seen;
}

describe('MarkdownEditor transitive import boundary (COR-1322)', () => {
  it('reaches no @milkdown/ or prosemirror- package through any static runtime import', async () => {
    const chains = await protectedChainsFrom(SOURCE_PATH);
    expect(chains.map(describeChain)).toEqual([]);
  });

  it('really walks into the editor attachment and the toolbar', async () => {
    // Guards against the walk going vacuous: the attachment shell and the
    // toolbar commands are reached, and the Milkdown-bound editor runtime is
    // not — it is behind attach.ts's dynamic import.
    const modules = [...(await reachableLocalModules(SOURCE_PATH))].map((path) =>
      path.replace(LIBRARY_ROOT, ''),
    );
    expect(modules).toContain('editor/attach.ts');
    expect(modules).toContain('editor/component-runtime.ts');
    expect(modules).toContain(
      'components/markdown-editor/editor-toolbar/toolbar-commands.svelte.ts',
    );
    expect(modules).not.toContain('editor/editor.ts');
    expect(modules).not.toContain('editor/index.ts');
  });

  it('defers the editor runtime to a dynamic import inside the asynchronous initialization', async () => {
    const attachPath = new URL('../../editor/attach.ts', import.meta.url).pathname;
    const text = await Bun.file(attachPath).text();
    expect(typeScriptRuntimeSpecifiers(attachPath, text)).not.toContain('./editor.js');
    expect(text).toContain("await import('./editor.js')");
  });
});

// ---------------------------------------------------------------------------
// Permanent synthetic fixtures for the transitive walk — prove it is
// fail-closed across files. In-memory modules stand in for the file system.
// ---------------------------------------------------------------------------

function fixtureReader(modules: Record<string, string>): ModuleReader {
  return async (path) => modules[path] ?? null;
}

describe('transitive import-boundary walk fixtures (fail-closed regression coverage)', () => {
  const component = '/fixture/component.svelte';

  it('FAILS: a runtime protected import two local files deep', async () => {
    const chains = await protectedChainsFrom(
      component,
      fixtureReader({
        [component]: `<script lang="ts">import { a } from './a.ts';</script><div></div>`,
        '/fixture/a.ts': `import { b } from './b.js';\nexport const a = b;`,
        '/fixture/b.ts': `import { Editor } from '@milkdown/kit/core';\nexport const b = Editor;`,
      }),
    );
    expect(chains).toEqual([[component, '/fixture/a.ts', '/fixture/b.ts', '@milkdown/kit/core']]);
  });

  it('PASSES: the deepest import is `import type`', async () => {
    const chains = await protectedChainsFrom(
      component,
      fixtureReader({
        [component]: `<script lang="ts">import { a } from './a.ts';</script><div></div>`,
        '/fixture/a.ts': `import { b } from './b.ts';\nexport const a = b;`,
        '/fixture/b.ts': `import type { Editor } from '@milkdown/kit/core';\nexport const b: Editor | null = null;`,
      }),
    );
    expect(chains).toEqual([]);
  });

  it('FAILS: a protected package reached through barrel re-exports', async () => {
    const chains = await protectedChainsFrom(
      component,
      fixtureReader({
        [component]: `<script lang="ts">import { a } from './index.ts';</script><div></div>`,
        '/fixture/index.ts': `export { a } from './a.ts';\nexport * from './b.ts';`,
        '/fixture/a.ts': `export const a = 1;`,
        '/fixture/b.ts': `export { Plugin } from 'prosemirror-state';`,
      }),
    );
    expect(chains).toEqual([
      [component, '/fixture/index.ts', '/fixture/b.ts', 'prosemirror-state'],
    ]);
  });

  it('PASSES: type-only re-exports and dynamic imports are not followed', async () => {
    const chains = await protectedChainsFrom(
      component,
      fixtureReader({
        [component]: `<script lang="ts">import { a } from './a.ts';</script><div></div>`,
        '/fixture/a.ts': `export type { Editor } from '@milkdown/kit/core';\nexport { type Plugin } from 'prosemirror-state';\nexport const a = () => import('./b.ts');`,
        '/fixture/b.ts': `import { Editor } from '@milkdown/kit/core';\nexport const b = Editor;`,
      }),
    );
    expect(chains).toEqual([]);
  });

  it('FAILS: an unresolvable local import fails the walk instead of passing silently', async () => {
    const failure = await protectedChainsFrom(
      component,
      fixtureReader({
        [component]: `<script lang="ts">import { a } from './missing.ts';</script><div></div>`,
      }),
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain('Cannot resolve ./missing.ts');
  });
});
