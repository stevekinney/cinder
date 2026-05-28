/**
 * MarkdownEditor import-boundary invariant
 *
 * Ensures that runtime packages with browser-global dependencies — Milkdown
 * and ProseMirror — are NEVER statically imported as values from
 * markdown-editor.svelte, and any dynamic import() of those packages is
 * guarded by a browser check that structurally dominates the call site.
 *
 * The protected package set is an exact prefix list: @milkdown/ and
 * prosemirror-. Adding a new package means adding to PROTECTED_PREFIXES.
 *
 * Guard detection: the import sits inside an effect arrow function whose body
 * opens with `if (!browser) return;` (early-return domination). A guard that
 * merely precedes the effect call, or that's in a sibling branch, does NOT
 * count.
 *
 * Uses svelte/compiler (already a project dependency) to parse the .svelte
 * source into an AST instead of regexing over source text, for structural
 * accuracy. Fails hard if the source file cannot be read.
 */

import { describe, expect, it } from 'bun:test';
import { parse } from 'svelte/compiler';

// Protected package set — single source of truth is scripts/ssr-import-boundary.ts.
// Defined inline because cross-package imports are outside the components rootDir.
const PROTECTED_PREFIXES = ['@milkdown/', 'prosemirror-'] as const;

function isProtected(specifier: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Minimal AST types (svelte/compiler returns acorn-compatible ESTree)
// ---------------------------------------------------------------------------
type AstNode = Record<string, unknown>;

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && 'type' in value;
}

// ---------------------------------------------------------------------------
// Guard detection: `if (!browser) return;` as the first statement
// ---------------------------------------------------------------------------
function isEarlyBrowserReturnGuard(statement: AstNode): boolean {
  if (statement['type'] !== 'IfStatement') return false;
  const test = statement['test'] as AstNode | undefined;
  if (!test || test['type'] !== 'UnaryExpression') return false;
  if (test['operator'] !== '!') return false;
  const argument = test['argument'] as AstNode | undefined;
  if (!argument || argument['type'] !== 'Identifier') return false;
  if (argument['name'] !== 'browser') return false;
  const consequent = statement['consequent'] as AstNode | undefined;
  if (!consequent || consequent['type'] !== 'ReturnStatement') return false;
  // Disallow else branches — they change the domination semantics
  if (statement['alternate']) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Find all dynamic import() expressions inside a node, returning specifiers
// ---------------------------------------------------------------------------
type DynamicImportInfo = {
  specifier: string | null; // null = non-literal specifier (also a violation)
  guardedByEarlyReturn: boolean;
};

function findDynamicImports(node: AstNode, dominatedByGuard: boolean): DynamicImportInfo[] {
  const results: DynamicImportInfo[] = [];

  if (node['type'] === 'ImportExpression') {
    const sourceNode = node['source'] as AstNode | undefined;
    const specifier =
      sourceNode && sourceNode['type'] === 'Literal' && typeof sourceNode['value'] === 'string'
        ? sourceNode['value']
        : null;
    results.push({ specifier, guardedByEarlyReturn: dominatedByGuard });
    return results;
  }

  // Arrow function body: detect domination by `if (!browser) return;`
  if (node['type'] === 'ArrowFunctionExpression') {
    const body = node['body'];
    if (isNode(body) && body['type'] === 'BlockStatement') {
      const stmts = (body['body'] as AstNode[]) ?? [];
      // First statement dominates the rest if it's an early-return guard
      const firstStmt = stmts[0];
      const dominated = firstStmt !== undefined && isEarlyBrowserReturnGuard(firstStmt);
      for (const stmt of stmts) {
        results.push(...findDynamicImports(stmt, dominated));
      }
      return results;
    }
    // Expression body — no opportunity for domination
    if (isNode(body)) {
      results.push(...findDynamicImports(body, false));
    }
    return results;
  }

  // Walk child nodes (generic)
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (isNode(item)) results.push(...findDynamicImports(item, dominatedByGuard));
      }
    } else if (isNode(child)) {
      results.push(...findDynamicImports(child, dominatedByGuard));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Violation collector — shared by production analysis and fixture tests
// ---------------------------------------------------------------------------

function collectViolations(statements: AstNode[]): {
  staticValueViolations: string[];
  unguardedDynamicViolations: string[];
  nonLiteralDynamicViolations: string[];
} {
  const staticValueViolations: string[] = [];
  const unguardedDynamicViolations: string[] = [];
  const nonLiteralDynamicViolations: string[] = [];

  for (const stmt of statements) {
    if (stmt['type'] === 'ImportDeclaration') {
      const importKind = stmt['importKind'] as string;
      const source_ = (stmt['source'] as AstNode)['value'] as string;
      if (importKind === 'value' && isProtected(source_)) {
        staticValueViolations.push(source_);
      }
      continue;
    }
    const dynamicImports = findDynamicImports(stmt, false);
    for (const { specifier, guardedByEarlyReturn } of dynamicImports) {
      if (specifier === null) {
        nonLiteralDynamicViolations.push('<non-literal specifier>');
        continue;
      }
      if (isProtected(specifier) && !guardedByEarlyReturn) {
        unguardedDynamicViolations.push(specifier);
      }
    }
  }

  return { staticValueViolations, unguardedDynamicViolations, nonLiteralDynamicViolations };
}

// ---------------------------------------------------------------------------
// Load and parse the MarkdownEditor source
// ---------------------------------------------------------------------------
const SOURCE_PATH = new URL('./markdown-editor.svelte', import.meta.url).pathname;
const source = await Bun.file(SOURCE_PATH)
  .text()
  .catch(() => {
    throw new Error(`[import-boundary] Cannot read ${SOURCE_PATH} — failing hard per plan`);
  });

const svelteAst = parse(source, { filename: SOURCE_PATH }) as unknown as AstNode;
const instanceBody: AstNode[] =
  (((svelteAst['instance'] as AstNode | undefined)?.['content'] as AstNode | undefined)?.[
    'body'
  ] as AstNode[] | undefined) ?? [];
const moduleBody: AstNode[] =
  (((svelteAst['module'] as AstNode | undefined)?.['content'] as AstNode | undefined)?.['body'] as
    | AstNode[]
    | undefined) ?? [];

// Production analysis: walk both module and instance script blocks.
const { staticValueViolations, unguardedDynamicViolations, nonLiteralDynamicViolations } =
  collectViolations([...moduleBody, ...instanceBody]);

// ---------------------------------------------------------------------------
// Tests (real component)
// ---------------------------------------------------------------------------
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

// Fixtures use only the instance body (no module script in these synthetic .svelte strings).
function analyzeFixture(svelteSource: string): ReturnType<typeof collectViolations> {
  const ast = parse(svelteSource, { filename: 'fixture.svelte' }) as unknown as AstNode;
  const body: AstNode[] =
    (((ast['instance'] as AstNode | undefined)?.['content'] as AstNode | undefined)?.['body'] as
      | AstNode[]
      | undefined) ?? [];
  return collectViolations(body);
}

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
