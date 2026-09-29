import { describe, expect, test } from 'bun:test';
import type { AST } from 'svelte/compiler';
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

function hasRuntimeValueBinding(statement: AstNode): boolean {
  if (nodeField(statement, 'importKind') === 'type') return false;
  const specifiers = nodeField(statement, 'specifiers');
  if (!Array.isArray(specifiers) || specifiers.length === 0) return true;
  return specifiers.some((specifier) => {
    if (!isNode(specifier) || specifier.type !== 'ImportSpecifier') return true;
    return nodeField(specifier, 'importKind') !== 'type';
  });
}

function collectProtectedRuntimeImports(statements: readonly AstNode[]): string[] {
  const violations: string[] = [];
  for (const statement of statements) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = nodeField(statement, 'source');
    const specifier = isNode(source) ? nodeField(source, 'value') : undefined;
    if (
      typeof specifier === 'string' &&
      isProtected(specifier) &&
      hasRuntimeValueBinding(statement)
    ) {
      violations.push(specifier);
    }
  }
  return violations;
}

function isTypeofDocumentReturnGuard(statement: unknown): boolean {
  if (!isNode(statement) || statement.type !== 'IfStatement') return false;
  const testExpression = nodeField(statement, 'test');
  return (
    isDocumentUndefinedTest(testExpression) &&
    hasNoAlternate(statement) &&
    hasEarlyReturn(nodeField(statement, 'consequent'))
  );
}

function isDocumentUndefinedTest(node: unknown): boolean {
  if (!isNode(node) || node.type !== 'BinaryExpression' || nodeField(node, 'operator') !== '===')
    return false;
  const left = nodeField(node, 'left');
  const right = nodeField(node, 'right');
  return isTypeofDocument(left) && isUndefinedLiteral(right);
}

function isTypeofDocument(node: unknown): boolean {
  if (!isNode(node) || node.type !== 'UnaryExpression' || nodeField(node, 'operator') !== 'typeof')
    return false;
  const argument = nodeField(node, 'argument');
  return (
    isNode(argument) && argument.type === 'Identifier' && nodeField(argument, 'name') === 'document'
  );
}

function isUndefinedLiteral(node: unknown): boolean {
  return isNode(node) && node.type === 'Literal' && nodeField(node, 'value') === 'undefined';
}

function hasNoAlternate(node: AstNode): boolean {
  const alternate = nodeField(node, 'alternate');
  return alternate === undefined || alternate === null;
}

function hasEarlyReturn(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === 'ReturnStatement') return true;
  const body = nodeField(node, 'body');
  return (
    node.type === 'BlockStatement' && Array.isArray(body) && body[0]?.type === 'ReturnStatement'
  );
}

function containsWindowGetSelectionCall(node: AstNode): boolean {
  return isWindowGetSelectionCall(node) || childNodes(node).some(containsWindowGetSelectionCall);
}

function isWindowGetSelectionCall(node: AstNode): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = nodeField(node, 'callee');
  if (!isNode(callee) || callee.type !== 'MemberExpression') return false;
  const object = nodeField(callee, 'object');
  const property = nodeField(callee, 'property');
  return (
    isNode(object) &&
    object.type === 'Identifier' &&
    nodeField(object, 'name') === 'window' &&
    isNode(property) &&
    property.type === 'Identifier' &&
    nodeField(property, 'name') === 'getSelection'
  );
}

type EffectInfo = { hasTypeofDocumentGuard: boolean; callsWindowGetSelection: boolean };

function findEffects(node: AstNode, output: EffectInfo[]): void {
  const effect = readEffect(node);
  if (effect) output.push(effect);
  for (const child of childNodes(node)) findEffects(child, output);
}

function collectEffects(root: AST.Root): EffectInfo[] {
  const output: EffectInfo[] = [];
  if (root.instance) findEffects(root.instance.content, output);
  return output;
}

function readEffect(node: AstNode): EffectInfo | null {
  if (node.type !== 'CallExpression') return null;
  const callee = nodeField(node, 'callee');
  const args = nodeField(node, 'arguments');
  const callback = Array.isArray(args) ? args[0] : undefined;
  if (!isNode(callee) || callee.type !== 'Identifier' || nodeField(callee, 'name') !== '$effect')
    return null;
  const statements = effectStatements(callback);
  if (!statements) return null;
  return {
    hasTypeofDocumentGuard: isTypeofDocumentReturnGuard(statements[0]),
    callsWindowGetSelection: statements.filter(isNode).some(containsWindowGetSelectionCall),
  };
}

function effectStatements(node: unknown): AstNode[] | null {
  if (!isNode(node) || node.type !== 'ArrowFunctionExpression') return null;
  const body = nodeField(node, 'body');
  if (!isNode(body) || body.type !== 'BlockStatement') return null;
  const statements = nodeField(body, 'body');
  return Array.isArray(statements) ? statements.filter(isNode) : null;
}

const WRAPPER_PATH = new URL('./review-editor.svelte', import.meta.url).pathname;
const IMPL_PATH = new URL('./review-editor-impl.svelte', import.meta.url).pathname;
const WRAPPER_SOURCE = await Bun.file(WRAPPER_PATH).text();
const IMPL_SOURCE = await Bun.file(IMPL_PATH).text();
const implAst = parseSvelte(IMPL_SOURCE, IMPL_PATH);
const implStatements = [
  ...scriptStatements(implAst, 'module'),
  ...scriptStatements(implAst, 'instance'),
];
const protectedRuntimeImports = collectProtectedRuntimeImports(implStatements);
const effects = collectEffects(implAst);
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

  test('counts each effect once and rejects missing or sibling document guards', () => {
    const fixture = parseSvelte(
      `<script>
        $effect(() => {
          if (typeof document === 'undefined') return;
          window.getSelection();
        });
        $effect(() => {
          window.getSelection();
        });
        $effect(() => {
          if (browser) {
            if (typeof document === 'undefined') return;
          }
          window.getSelection();
        });
      </script>`,
      'review-editor-effect-fixture.svelte',
    );
    const fixtureEffects = collectEffects(fixture);

    expect(fixtureEffects).toHaveLength(3);
    expect(
      fixtureEffects.filter(
        (effect) => effect.hasTypeofDocumentGuard && effect.callsWindowGetSelection,
      ),
    ).toHaveLength(1);
  });
});
