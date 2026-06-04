/**
 * ReviewEditor SSR-safety contract (source-level verification).
 *
 * ReviewEditor is MarkdownEditor extended with anchored comment threads. Its
 * SSR story has two layers:
 *
 *   1. The live ProseMirror editor is owned by the inner MarkdownEditor, which
 *      mounts it inside `{#if browser}` and renders `<EditorSkeleton>` on the
 *      server (verified in `markdown-editor.hydrate.test.ts`). ReviewEditor
 *      forwards to that component, so it inherits the server-side skeleton
 *      fallback for free.
 *
 *   2. ReviewEditor's own logic statically imports the commentary and markdown
 *      surfaces (`@lostgradient/cinder/commentary/anchor-decorations`, `@lostgradient/cinder/markdown/
 *      pipeline`, `@lostgradient/cinder/markdown/diff/line-diff`, `@lostgradient/cinder/editor`). Those are
 *      all SSR-safe at module-evaluation time — proven by
 *      `packages/commentary/src/ssr-import.test.ts` and
 *      `packages/markdown/src/ssr-import.test.ts` — so the static imports do
 *      not throw during SSR. The only DOM access in this layer
 *      (`document.*`, `window.getSelection()`) lives inside `$effect` bodies,
 *      which never run on the server; the selection-change effect additionally
 *      carries an explicit `if (typeof document === 'undefined') return;`
 *      guard as defense in depth.
 *
 * Full SSR-render + hydrate of ReviewEditor is blocked in the Bun test harness
 * for the reason documented in `markdown-editor.hydrate.test.ts` (the
 * recompiled server module resolves its child-component imports against the
 * client compilation, producing `effect_orphan`). We therefore verify the SSR
 * contract at the source level, the established convention for these
 * editor-heavy components.
 *
 * Verification is performed against the parsed AST (via `svelte/compiler`)
 * rather than raw-source regex/`indexOf`. The AST distinguishes value imports
 * from fully-erased type-only imports and locates the `window.getSelection()`
 * call structurally, so the contract checks do not produce false positives
 * from `import { type Foo }` specifiers or from `getSelection` mentions inside
 * comments.
 */

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

// Runtime packages whose entry points reach for browser globals. A static
// value import of any of these at the component layer would be a new,
// unaudited SSR-unsafe entry point. Mirrors the protected set in
// `markdown-editor.import-boundary.test.ts`.
const PROTECTED_PREFIXES = ['@milkdown/', 'prosemirror-'] as const;

function isProtected(specifier: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Minimal AST helpers (svelte/compiler returns acorn-compatible ESTree)
// ---------------------------------------------------------------------------
type AstNode = Record<string, unknown>;

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function scriptBody(ast: AstNode, block: 'module' | 'instance'): AstNode[] {
  const content = (ast[block] as AstNode | undefined)?.['content'] as AstNode | undefined;
  return (content?.['body'] as AstNode[] | undefined) ?? [];
}

// ---------------------------------------------------------------------------
// Static import analysis: a protected import is a runtime (SSR-relevant)
// import only when it brings at least one *value* binding into scope.
//
//   import type { Foo } from 'prosemirror-view'   -> declaration importKind 'type', erased
//   import { type Foo } from 'prosemirror-view'   -> per-specifier importKind 'type', erased
//   import { type Foo, bar } from 'prosemirror-…' -> `bar` is a value binding, NOT erased
//   import Foo / import * as Foo from 'prosemirror-…' -> default/namespace value bindings
// ---------------------------------------------------------------------------
function hasRuntimeValueBinding(declaration: AstNode): boolean {
  // `import type { … }` / `import type Foo` — whole declaration is type-only.
  if (declaration['importKind'] === 'type') return false;

  const specifiers = (declaration['specifiers'] as AstNode[] | undefined) ?? [];

  // A bare side-effect import (`import 'pkg'`) still evaluates the module at
  // runtime, so treat it as a runtime import.
  if (specifiers.length === 0) return true;

  return specifiers.some((specifier) => {
    // Default and namespace specifiers are always value bindings.
    if (specifier['type'] !== 'ImportSpecifier') return true;
    // Inline `import { type Foo }` specifiers are erased.
    return specifier['importKind'] !== 'type';
  });
}

function collectProtectedRuntimeImports(statements: AstNode[]): string[] {
  const violations: string[] = [];
  for (const statement of statements) {
    if (statement['type'] !== 'ImportDeclaration') continue;
    const source = (statement['source'] as AstNode | undefined)?.['value'];
    if (typeof source !== 'string' || !isProtected(source)) continue;
    if (hasRuntimeValueBinding(statement)) {
      violations.push(source);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Guarded-effect detection: locate `$effect(() => { … })` calls whose body
// opens with `if (typeof document === 'undefined') return;`, and report which
// of those effects contain a `window.getSelection()` call expression.
// ---------------------------------------------------------------------------

/** `if (typeof document === 'undefined') return;` as the first statement. */
function isTypeofDocumentReturnGuard(statement: AstNode | undefined): boolean {
  if (!statement || statement['type'] !== 'IfStatement') return false;

  const testExpression = statement['test'];
  if (
    !isNode(testExpression) ||
    testExpression['type'] !== 'BinaryExpression' ||
    testExpression['operator'] !== '==='
  ) {
    return false;
  }

  const left = testExpression['left'];
  const right = testExpression['right'];
  const argument = isNode(left) ? left['argument'] : undefined;
  const isTypeofDocument =
    isNode(left) &&
    left['type'] === 'UnaryExpression' &&
    left['operator'] === 'typeof' &&
    isNode(argument) &&
    argument['type'] === 'Identifier' &&
    argument['name'] === 'document';
  const isUndefinedLiteral =
    isNode(right) && right['type'] === 'Literal' && right['value'] === 'undefined';
  if (!isTypeofDocument || !isUndefinedLiteral) return false;

  // The guard must early-return (not fall through to an else branch).
  const consequent = statement['consequent'] as AstNode | undefined;
  if (statement['alternate']) return false;
  if (consequent && consequent['type'] === 'ReturnStatement') return true;
  if (consequent && consequent['type'] === 'BlockStatement') {
    const inner = (consequent['body'] as AstNode[] | undefined)?.[0];
    return !!inner && inner['type'] === 'ReturnStatement';
  }
  return false;
}

/** Recursively detect a `window.getSelection()` call expression. */
function containsWindowGetSelectionCall(node: unknown): boolean {
  if (!isNode(node)) {
    if (Array.isArray(node)) return node.some(containsWindowGetSelectionCall);
    return false;
  }

  if (node['type'] === 'CallExpression') {
    const callee = node['callee'];
    if (isNode(callee) && callee['type'] === 'MemberExpression') {
      const object = callee['object'];
      const property = callee['property'];
      if (
        isNode(object) &&
        object['type'] === 'Identifier' &&
        object['name'] === 'window' &&
        isNode(property) &&
        property['type'] === 'Identifier' &&
        property['name'] === 'getSelection'
      ) {
        return true;
      }
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    if (containsWindowGetSelectionCall(node[key])) return true;
  }
  return false;
}

type EffectInfo = { hasTypeofDocumentGuard: boolean; callsWindowGetSelection: boolean };

/** Find every `$effect(() => { … })` arrow-callback effect in the AST. */
function findEffects(node: unknown, out: EffectInfo[]): void {
  if (!isNode(node)) {
    if (Array.isArray(node)) for (const item of node) findEffects(item, out);
    return;
  }

  if (node['type'] === 'CallExpression') {
    const callee = node['callee'];
    const args = (node['arguments'] as AstNode[] | undefined) ?? [];
    const callback = args[0];
    if (
      isNode(callee) &&
      callee['type'] === 'Identifier' &&
      callee['name'] === '$effect' &&
      callback &&
      callback['type'] === 'ArrowFunctionExpression' &&
      isNode(callback['body']) &&
      callback['body']['type'] === 'BlockStatement'
    ) {
      const callbackBody = callback['body'];
      const body = callbackBody['body'] as AstNode[] | undefined;
      out.push({
        hasTypeofDocumentGuard: isTypeofDocumentReturnGuard(body?.[0]),
        callsWindowGetSelection: containsWindowGetSelectionCall(callbackBody),
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
    findEffects(node[key], out);
  }
}

// ---------------------------------------------------------------------------
// Load and parse the wrapper + implementation sources
// ---------------------------------------------------------------------------
const WRAPPER_PATH = new URL('./review-editor.svelte', import.meta.url).pathname;
const IMPL_PATH = new URL('./review-editor-impl.svelte', import.meta.url).pathname;

const WRAPPER_SOURCE = await Bun.file(WRAPPER_PATH).text();
const IMPL_SOURCE = await Bun.file(IMPL_PATH).text();

const implAst = parse(IMPL_SOURCE, { filename: IMPL_PATH }) as unknown as AstNode;
const implStatements = [...scriptBody(implAst, 'module'), ...scriptBody(implAst, 'instance')];

const protectedRuntimeImports = collectProtectedRuntimeImports(implStatements);

const effects: EffectInfo[] = [];
findEffects(implAst['instance'], effects);
const guardedSelectionEffects = effects.filter(
  (effect) => effect.hasTypeofDocumentGuard && effect.callsWindowGetSelection,
);

describe('ReviewEditor SSR contract (source-level verification)', () => {
  test('renders through MarkdownEditor, inheriting its server-side skeleton fallback', () => {
    // The public wrapper forwards to the implementation, and the
    // implementation renders MarkdownEditor — the component that provides the
    // `{#if browser}` → `<EditorSkeleton>` SSR fallback.
    expect(WRAPPER_SOURCE).toContain('ReviewEditorImplementation');
    expect(IMPL_SOURCE).toContain('<MarkdownEditor');
  });

  test('statically imports only SSR-safe package surfaces (no @milkdown/ or prosemirror- value import at this layer)', () => {
    // ReviewEditor reaches ProseMirror only through cinder/commentary's
    // anchor-decorations re-export, which is SSR-safe at module-eval time. A
    // direct static @milkdown/ or prosemirror- *value* import at the component
    // layer would be a new, unaudited browser-bound entry point. Type-only
    // imports (`import type` and `import { type … }`) are erased at runtime and
    // therefore not violations.
    expect(protectedRuntimeImports).toEqual([]);
  });

  test('guards window.getSelection() behind a $effect with a typeof-document SSR guard', () => {
    // Every browser-global access in the implementation must sit inside an
    // $effect so it never runs during SSR. The selection-change effect — the
    // component's primary DOM consumer — must both call window.getSelection()
    // and early-return when `document` is undefined. We assert the structural
    // co-location via the AST so the check cannot be satisfied by a comment.
    expect(guardedSelectionEffects.length).toBeGreaterThan(0);
  });
});
