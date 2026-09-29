import { describe, expect, it } from 'bun:test';
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
// Preview must not initialize Milkdown on a preview-only mount. The component
// graph already reaches Milkdown statically through `../../editor/index.ts`
// (a pre-existing fact outside COR-525's scope), so this guards what COR-525
// can: the new modules add no static Milkdown or ProseMirror import anywhere
// in their own local graph, and the component's history import waits for a
// rich editor to exist.
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
