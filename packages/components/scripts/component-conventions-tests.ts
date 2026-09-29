/** Test and accessibility coverage predicates for component tooling. */

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { Node, Project, type CallExpression, type SourceFile } from 'ts-morph';

// ---------------------------------------------------------------------------

const INTERACTIVE_CATEGORIES = new Set(['action', 'form', 'navigation', 'overlay']);

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
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const directory = dirname(testFilePath);
  const filename = basename(testFilePath);
  const stem = filename.replace(/\.test\.ts$/, '');
  const candidates = existsSync(testFilePath) ? [testFilePath] : [];
  if (existsSync(directory)) {
    for (const entry of readdirSync(directory)) {
      if (entry.startsWith(`${stem}-`) && entry.endsWith('.test.ts')) {
        candidates.push(join(directory, entry));
      }
    }
  }
  const count = candidates.reduce(
    (total, candidate) => total + countActiveTestCalls(project.addSourceFileAtPath(candidate)),
    0,
  );
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

  for (const testCall of collectActiveTestCalls(sourceFile)) {
    if (hasKeyboardCall(testCall) && hasAriaOrRoleCall(testCall)) {
      return true;
    }
  }
  return false;
}

/** Collect all `test(...)` / `it(...)` CallExpression nodes in the file. */
export function collectActiveTestCalls(sourceFile: SourceFile): CallExpression[] {
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
    if (!found && Node.isCallExpression(node)) found = isAriaOrRoleCall(node, ROLE_QUERY_METHODS);
  });

  return found;
}

function isAriaOrRoleCall(call: CallExpression, roleQueryMethods: ReadonlySet<string>): boolean {
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression) && roleQueryMethods.has(expression.getName())) {
    return true;
  }
  if (Node.isIdentifier(expression) && roleQueryMethods.has(expression.getText())) return true;
  return isAriaAttributeAssertion(expression, call);
}

function isAriaAttributeAssertion(
  expression: ReturnType<CallExpression['getExpression']>,
  call: CallExpression,
): boolean {
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== 'toHaveAttribute') {
    return false;
  }
  const firstArg = call.getArguments()[0];
  if (!firstArg || !Node.isStringLiteral(firstArg)) return false;
  const value = firstArg.getLiteralValue();
  return value === 'role' || value.startsWith('aria-');
}

// ---------------------------------------------------------------------------
