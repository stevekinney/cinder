/**
 * Shared predicates consumed by the stable-promotion gate
 * (`check-promotion-readiness.ts`) and any sibling convention checkers.
 *
 * Parser boundary:
 *   - ts-morph parses ONLY `.test.ts` files (TypeScript AST).
 *   - svelte/compiler parses ONLY `.svelte` files (Svelte AST).
 *   Two parsers, explicit boundary, no substring fallback.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse as parseSvelte } from 'svelte/compiler';
import { Node, Project, type CallExpression, type SourceFile } from 'ts-morph';

// ---------------------------------------------------------------------------
// Interactive categories — components in these categories require a11y checks.
// Source of truth: manifest.meta.ts categoryId set.
// ---------------------------------------------------------------------------

const INTERACTIVE_CATEGORIES = new Set(['action', 'form', 'navigation', 'overlay']);

// ---------------------------------------------------------------------------
// Prop-name denylist (frozen per plan spec).
// These are exact forbidden prop-name strings, compared case-sensitively.
// They fall into two groups:
//   1. Wrong-cased / abbreviated forms cinder prohibits (`classname`, `icononly`, …).
//   2. Valid-camelCase names that nonetheless violate a cinder API convention:
//      `className` is forbidden because cinder components expose `class?: string`
//      and destructure it internally as `class: className` — the public prop is
//      `class`, never `className`. (camelCase alone would let `className` pass.)
// ---------------------------------------------------------------------------

export const PROP_NAME_DENYLIST = [
  'classname',
  'className',
  'icononly',
  'leadingicon',
  'trailingicon',
  'ondismiss',
  'onchange',
] as const satisfies readonly string[];

// ---------------------------------------------------------------------------
// Check 1 — Substantive test present
// ---------------------------------------------------------------------------

/** Counts bare `test(...)` or `it(...)` CallExpressions, excluding .skip / .todo / .failing. */
function countActiveTestCalls(sourceFile: SourceFile): number {
  let count = 0;
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    // Bare `test` or `it` identifier — not a property access like `test.skip`.
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (name === 'test' || name === 'it') {
        count++;
      }
    }
  });
  return count;
}

/**
 * Returns `{ pass, count }` where `pass` is `true` when `testFilePath` exists
 * and contains at least one active `test(...)` or `it(...)` call (not `.skip`,
 * `.todo`, or `.failing`).
 */
export function hasSubstantiveTest(testFilePath: string): { pass: boolean; count: number } {
  if (!existsSync(testFilePath)) return { pass: false, count: 0 };

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(testFilePath);
  const count = countActiveTestCalls(sourceFile);
  return { pass: count >= 1, count };
}

// ---------------------------------------------------------------------------
// Check 2 helpers — a11y coverage
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the component's category indicates it is interactive
 * and therefore requires a11y coverage.
 *
 * Accepts a partial manifest entry — only `category` is needed.
 */
export function isInteractive(manifestEntry: { category?: string }): boolean {
  return manifestEntry.category !== undefined && INTERACTIVE_CATEGORIES.has(manifestEntry.category);
}

/**
 * Returns `true` when an a11y doc exists at either canonical location:
 *   1. Adjacent: `<componentDir>/<name>.a11y.md`
 *   2. Legacy flat: `src/components/<name>.a11y.md`
 *
 * The legacy flat path is always anchored at the `src/components` root, not at
 * the component's immediate parent — for an experimental component at
 * `src/components/experimental/<name>/`, the flat doc still lives at
 * `src/components/<name>.a11y.md`, not `src/components/experimental/<name>.a11y.md`.
 */
export function hasA11yDoc(componentDir: string, componentName: string): boolean {
  const adjacent = join(componentDir, `${componentName}.a11y.md`);

  // Anchor the legacy flat path at the `src/components` root. Walk up from the
  // component directory until the parent segment is `components`.
  let candidate = componentDir;
  for (let depth = 0; depth < 3; depth += 1) {
    const parent = dirname(candidate);
    if (basename(parent) === 'components') {
      const flat = join(parent, `${componentName}.a11y.md`);
      return existsSync(adjacent) || existsSync(flat);
    }
    candidate = parent;
  }

  // Fallback: if we never found a `components` ancestor, use the immediate parent.
  const flat = join(dirname(componentDir), `${componentName}.a11y.md`);
  return existsSync(adjacent) || existsSync(flat);
}

/**
 * Returns `true` when the given test file contains, within a SINGLE
 * `test(...)` or `it(...)` call expression's subtree, BOTH:
 *   - A keyboard call: `fireEvent.keyDown(...)` or `user.keyboard(...)`
 *   - An ARIA/role query: `getByRole(...)`, `findByRole(...)`, `queryByRole(...)`,
 *     or `expect(...).toHaveAttribute(name)` where name is `"role"` or starts
 *     with `"aria-"`.
 *
 * Setup-only mentions outside a test block do not count.
 */
export function hasA11yCoverage(testFilePath: string): boolean {
  if (!existsSync(testFilePath)) return false;

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(testFilePath);

  for (const testCall of collectTestCalls(sourceFile)) {
    if (hasKeyboardCall(testCall) && hasAriaOrRoleCall(testCall)) {
      return true;
    }
  }
  return false;
}

/** Collect all `test(...)` / `it(...)` CallExpression nodes in the file. */
function collectTestCalls(sourceFile: SourceFile): CallExpression[] {
  const testCalls: CallExpression[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (name === 'test' || name === 'it') {
        testCalls.push(node);
      }
    }
  });
  return testCalls;
}

/** Returns `true` if the subtree contains `fireEvent.keyDown(...)` or `user.keyboard(...)`. */
function hasKeyboardCall(root: CallExpression): boolean {
  let found = false;
  root.forEachDescendant((node) => {
    if (found || !Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;
    const objectName = expression.getExpression().getText();
    const propertyName = expression.getName();
    if (
      (objectName === 'fireEvent' && propertyName === 'keyDown') ||
      (objectName === 'user' && propertyName === 'keyboard')
    ) {
      found = true;
    }
  });
  return found;
}

/** Returns `true` if the subtree contains a role/aria query or toHaveAttribute with role/aria-*. */
function hasAriaOrRoleCall(root: CallExpression): boolean {
  const ROLE_QUERY_METHODS = new Set(['getByRole', 'findByRole', 'queryByRole']);
  let found = false;

  root.forEachDescendant((node) => {
    if (found) return;

    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      // getByRole / findByRole / queryByRole as a property access (e.g. screen.getByRole)
      if (Node.isPropertyAccessExpression(expression)) {
        if (ROLE_QUERY_METHODS.has(expression.getName())) {
          found = true;
          return;
        }
      }

      // Bare getByRole / findByRole / queryByRole call
      if (Node.isIdentifier(expression) && ROLE_QUERY_METHODS.has(expression.getText())) {
        found = true;
        return;
      }

      // expect(...).toHaveAttribute(name) where name is "role" or starts with "aria-"
      if (
        Node.isPropertyAccessExpression(expression) &&
        expression.getName() === 'toHaveAttribute'
      ) {
        const args = node.getArguments();
        const firstArg = args[0];
        if (firstArg && Node.isStringLiteral(firstArg)) {
          const value = firstArg.getLiteralValue();
          if (value === 'role' || value.startsWith('aria-')) {
            found = true;
          }
        }
      }
    }
  });

  return found;
}

// ---------------------------------------------------------------------------
// Check 3 — hydration/SSR coverage
// ---------------------------------------------------------------------------

/**
 * Narrow an unknown value to an indexable record. The Svelte compiler returns
 * an untyped AST (`parse()` has no useful type), so every structural step below
 * narrows through this guard rather than asserting `as Record<…>`.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Read a property as a nested record, or `undefined` if it isn't one. */
function recordProperty(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

/**
 * Returns `true` when the Svelte component at `sveltePath` contains a browser
 * guard: either a `{#if browser}` / `{#if hydrated}` template block, or imports
 * `BROWSER` from `esm-env`.
 *
 * Uses svelte/compiler for structural detection — no substring matching.
 */
export function hasBrowserGuard(sveltePath: string): boolean {
  if (!existsSync(sveltePath)) return false;
  const source = readFileSync(sveltePath, 'utf8');
  return hasBrowserGuardInSource(source);
}

function hasBrowserGuardInSource(source: string): boolean {
  const ast: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(ast)) return false;

  // Check 1: a <script> block imports BROWSER from esm-env (structural — walk
  // the module and instance script ASTs, not a substring/regex on raw source).
  if (
    scriptImportsBrowserFromEsmEnv(ast['module']) ||
    scriptImportsBrowserFromEsmEnv(ast['instance'])
  ) {
    return true;
  }

  // Check 2: template contains {#if browser} or {#if hydrated}
  return templateHasBrowserIfBlock(ast['fragment']);
}

/**
 * Returns `true` when the given Svelte `<script>` node (module or instance)
 * contains an `import { BROWSER } from 'esm-env'` declaration. Walks the ESTree
 * body the Svelte compiler attaches at `script.content.body` — no substring match.
 */
function scriptImportsBrowserFromEsmEnv(scriptNode: unknown): boolean {
  if (!isRecord(scriptNode)) return false;
  const content = recordProperty(scriptNode, 'content');
  if (!content) return false;
  const body = content['body'];
  if (!Array.isArray(body)) return false;

  for (const statement of body) {
    if (!isRecord(statement)) continue;
    if (statement['type'] !== 'ImportDeclaration') continue;
    const sourceNode = recordProperty(statement, 'source');
    if (sourceNode?.['value'] !== 'esm-env') continue;
    const specifiers = statement['specifiers'];
    if (!Array.isArray(specifiers)) continue;
    for (const specifier of specifiers) {
      if (!isRecord(specifier)) continue;
      const imported = recordProperty(specifier, 'imported');
      if (imported?.['name'] === 'BROWSER') return true;
    }
  }
  return false;
}

/**
 * Recursively walks the Svelte template AST fragment to find an IfBlock
 * whose test expression is the identifier `browser` or `hydrated`.
 */
function templateHasBrowserIfBlock(node: unknown): boolean {
  if (!isRecord(node)) return false;
  const record = node;

  if (record['type'] === 'IfBlock') {
    const test = recordProperty(record, 'test');
    if (test && test['type'] === 'Identifier') {
      const name = test['name'];
      if (name === 'browser' || name === 'hydrated') return true;
    }
  }

  // Recurse into all array/object children.
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (templateHasBrowserIfBlock(child)) return true;
      }
    } else if (value && typeof value === 'object') {
      if (templateHasBrowserIfBlock(value)) return true;
    }
  }
  return false;
}

/**
 * Returns `true` when the test file contains a `render` call from
 * `svelte/server` OR a `renderThenHydrate` call.
 * A test merely named "hydrates" does not satisfy this.
 */
export function hasHydrationTest(testFilePath: string): boolean {
  if (!existsSync(testFilePath)) return false;

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(testFilePath);

  const renderIsFromSvelteServer = isImportedFromSvelteServer(sourceFile, 'render');

  // Scope the search to ACTIVE test(...)/it(...) blocks only — a render or
  // renderThenHydrate call inside test.skip / test.todo would never run, so it
  // must not satisfy the hydration gate (mirrors the substantive-test check).
  for (const testCall of collectTestCalls(sourceFile)) {
    let found = false;
    testCall.forEachDescendant((node) => {
      if (found || !Node.isCallExpression(node)) return;
      const expression = node.getExpression();
      if (!Node.isIdentifier(expression)) return;
      const name = expression.getText();
      if (name === 'renderThenHydrate') {
        found = true;
      } else if (name === 'render' && renderIsFromSvelteServer) {
        found = true;
      }
    });
    if (found) return true;
  }
  return false;
}

/** Returns `true` when `name` is imported from `svelte/server` in the given file. */
function isImportedFromSvelteServer(sourceFile: SourceFile, name: string): boolean {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== 'svelte/server') continue;
    for (const specifier of declaration.getNamedImports()) {
      if (specifier.getName() === name) return true;
    }
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport?.getText() === name) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Check 4 — prop-name conventions
// ---------------------------------------------------------------------------

/**
 * Validates all prop names in a JSON Schema object against cinder conventions:
 *   - Must be camelCase (or `class`, or `aria-*` / `data-*`)
 *   - Must not appear in PROP_NAME_DENYLIST (exact lowercase match)
 *   - `is`-prefixed boolean props produce warnings, not violations
 *
 * Returns `{ violations, warnings }` — empty arrays indicate PASS.
 */
export function checkPropNames(schema: Record<string, unknown>): {
  violations: string[];
  warnings: string[];
} {
  const properties = schema['properties'];
  if (!isRecord(properties)) {
    return { violations: [], warnings: [] };
  }

  const violations: string[] = [];
  const warnings: string[] = [];

  for (const propName of Object.keys(properties)) {
    const violation = validatePropNameViolation(propName);
    if (violation !== null) {
      violations.push(`"${propName}": ${violation}`);
      continue;
    }
    if (hasBooleanIsPrefix(propName)) {
      warnings.push(
        `"${propName}": is-prefix convention — consider renaming to drop the is/has prefix`,
      );
    }
  }

  return { violations, warnings };
}

/**
 * Returns a violation reason string, or null if the name is acceptable.
 * Does NOT emit warnings — those are handled in `checkPropNames`.
 */
function validatePropNameViolation(name: string): string | null {
  // Allow: class passthrough
  if (name === 'class') return null;

  // Allow: aria-* and data-* passthrough
  if (name.startsWith('aria-') || name.startsWith('data-')) return null;

  // Deny: exact case-sensitive match against the denylist.
  // The denylist enumerates the wrong-cased / abbreviated prop names that
  // cinder explicitly forbids. These are already in the form they must not
  // appear as — e.g. `icononly` is forbidden, but `iconOnly` (camelCase) is
  // the correct form and is NOT denied by this check.
  if ((PROP_NAME_DENYLIST as readonly string[]).includes(name)) {
    return `"${name}" is in the prop-name denylist`;
  }

  // Must be camelCase: starts with lowercase letter, contains only letters and digits.
  if (!isCamelCase(name)) {
    return `"${name}" is not camelCase`;
  }

  return null;
}

/**
 * Returns `true` when `name` is a valid camelCase identifier:
 * starts with a lowercase letter, contains only letters and digits.
 */
function isCamelCase(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

/**
 * Returns `true` when `name` starts with `is` or `has` followed by an
 * uppercase letter (boolean is-prefix convention).
 * Used to emit a WARNING (not a failure) in the promotion gate.
 */
export function hasBooleanIsPrefix(name: string): boolean {
  return /^is[A-Z]/.test(name) || /^has[A-Z]/.test(name);
}
