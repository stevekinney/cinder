/**
 * Test-isolation policy guard (two rules).
 *
 * The suite runs every `*.test.ts` in ONE process under `bun test --parallel=1`,
 * sharing a single happy-dom `Window`. Anything a test leaves mounted, or any
 * global it overrides without restoring, bleeds into every later test file. This
 * passes in isolation and ONLY fails in the full suite — exactly the class of
 * CI-only flake that crashed `validate` and blocked the release pipeline
 * (combobox, then dropdown). Two rules close it:
 *
 *   Rule 1 — cleanup: a test that imports `@testing-library/svelte`, calls its
 *   `render(`, and reads shared global DOM (`document.activeElement` /
 *   `document.body`) MUST reference `cleanup` inside a teardown hook
 *   (`afterEach`/`afterAll`) — either `afterEach(cleanup)` or a call to
 *   `cleanup()` in the hook body.
 *
 *   Rule 2 — orphaned override: a test that overrides a hazardous process-global
 *   (ResizeObserver, getComputedStyle, matchMedia, …) at module scope MUST have a
 *   teardown hook (`afterEach`/`afterAll`/`finally`) that can undo it. The guard
 *   checks only that a teardown EXISTS, not that it restores the saved original
 *   correctly — restore-correctness is a dataflow property a linter can't decide
 *   without false-positiving legitimate indirection (a `restore()` method called
 *   from `afterEach`, descriptor save/restore). The known offenders are hardened
 *   in their test files; this rule stops a future *orphaned* override (a stub
 *   with nothing to undo it) from reintroducing the class.
 *
 * Scope is the whole package `src/**` — the override hazard is not
 * component-specific; `_internal`/utility tests share the same Window. Files that
 * drive Svelte's `mount`/`unmount` directly (own target + teardown, no
 * testing-library) are out of Rule 1 via the testing-library-import requirement.
 *
 * Detection walks the TypeScript AST (typescript is already a devDependency), so
 * braces/parens/keywords inside strings, template literals, regex literals, and
 * comments cannot confuse the "is this inside a teardown hook?" decision — a
 * hazard a text-based matcher could not avoid. oxlint can't express this rule, so
 * it is a standalone script wired into `bun run lint` (and therefore CI).
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(scriptDirectory, '..', 'src');
const repoRoot = resolve(srcRoot, '..', '..', '..');

const TEARDOWN_HOOK_NAMES = new Set(['afterEach', 'afterAll']);

// The known cross-test-pollution surface — observers, layout/animation, and
// media APIs. Not arbitrary `globalThis.foo` scratch.
const HAZARDOUS_GLOBALS = new Set<string>([
  'ResizeObserver',
  'IntersectionObserver',
  'IntersectionObserverEntry',
  'MutationObserver',
  'getComputedStyle',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]);

const GLOBAL_RECEIVERS = new Set(['globalThis', 'window', 'navigator']);

type Violation = { filePath: string; reason: string };

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Walk every node in the tree, depth-first. */
function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

/** `<receiver>.<name>` where receiver is a bare global identifier. */
function globalPropertyName(node: ts.Node): string | null {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    GLOBAL_RECEIVERS.has(node.expression.text)
  ) {
    return node.name.text;
  }
  return null;
}

/** A call to `afterEach(...)` / `afterAll(...)`. */
function isTeardownHookCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    TEARDOWN_HOOK_NAMES.has(node.expression.text)
  );
}

/** Does any node in `root`'s subtree reference an identifier named `cleanup`? */
function subtreeReferencesCleanup(root: ts.Node): boolean {
  let found = false;
  walk(root, (node) => {
    if (ts.isIdentifier(node) && node.text === 'cleanup') found = true;
  });
  return found;
}

function findCleanupViolation(source: string, sourceFile: ts.SourceFile): string | null {
  const rendersIntoSharedDom =
    /@testing-library\/svelte/.test(source) &&
    /\brender\s*\(/.test(source) &&
    /document\.(?:activeElement|body)\b/.test(source);
  if (!rendersIntoSharedDom) return null;

  // `cleanup` must be referenced inside an afterEach/afterAll hook — covers
  // `afterEach(cleanup)` and `afterEach(() => cleanup())` / block bodies alike.
  let cleanupInTeardown = false;
  walk(sourceFile, (node) => {
    if (isTeardownHookCall(node) && node.arguments.some(subtreeReferencesCleanup)) {
      cleanupInTeardown = true;
    }
  });
  if (cleanupInTeardown) return null;
  return 'renders into shared document.body but never calls cleanup() in a teardown hook';
}

/** Hazardous globals overridden anywhere in the file (assignment or defineProperty). */
function overriddenHazardousGlobals(sourceFile: ts.SourceFile): Set<string> {
  const overridden = new Set<string>();
  walk(sourceFile, (node) => {
    // `globalThis.X = …`
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const property = globalPropertyName(node.left);
      if (property && HAZARDOUS_GLOBALS.has(property)) overridden.add(property);
    }
    // `Object.defineProperty(globalThis, 'X', …)`
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Object' &&
      node.expression.name.text === 'defineProperty'
    ) {
      const [target, key] = node.arguments;
      if (
        target &&
        ts.isIdentifier(target) &&
        GLOBAL_RECEIVERS.has(target.text) &&
        key &&
        ts.isStringLiteralLike(key) &&
        HAZARDOUS_GLOBALS.has(key.text)
      ) {
        overridden.add(key.text);
      }
    }
  });
  return overridden;
}

/** True when the file has any teardown hook: afterEach/afterAll call or a finally block. */
function hasTeardownHook(sourceFile: ts.SourceFile): boolean {
  let found = false;
  walk(sourceFile, (node) => {
    if (isTeardownHookCall(node)) found = true;
    if (ts.isTryStatement(node) && node.finallyBlock) found = true;
  });
  return found;
}

function findGlobalOverrideViolation(sourceFile: ts.SourceFile): string | null {
  const overridden = overriddenHazardousGlobals(sourceFile);
  if (overridden.size === 0) return null;
  if (hasTeardownHook(sourceFile)) return null;
  return `overrides global ${[...overridden].join(', ')} but has no teardown hook (afterEach/afterAll/finally) to restore it`;
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('**/*.test.ts');

  for await (const relativePath of glob.scan({ cwd: srcRoot })) {
    const absolutePath = resolve(srcRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const sourceFile = parse(source, absolutePath);
    const filePath = relative(repoRoot, absolutePath);

    const cleanupReason = findCleanupViolation(source, sourceFile);
    if (cleanupReason) violations.push({ filePath, reason: cleanupReason });

    const overrideReason = findGlobalOverrideViolation(sourceFile);
    if (overrideReason) violations.push({ filePath, reason: overrideReason });
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await scan();
  if (violations.length === 0) {
    process.stdout.write(
      'check-test-cleanup — OK (tests unmount renders and restore overridden globals).\n',
    );
    return;
  }

  process.stderr.write(
    'check-test-cleanup — test-isolation hazard(s) detected. The suite shares one process-\n' +
      'global Window (--parallel=1), so un-torn-down state leaks into later test files and\n' +
      'flakes on CI. Two rules:\n\n' +
      '  1. A test that renders via @testing-library/svelte and reads document.activeElement/\n' +
      '     document.body MUST call cleanup() inside an afterEach/afterAll.\n' +
      '  2. A test that overrides a global (ResizeObserver, getComputedStyle, matchMedia, …)\n' +
      '     MUST save the original and restore it inside a teardown hook:\n\n' +
      '       const original = globalThis.ResizeObserver;\n' +
      '       globalThis.ResizeObserver = Stub;\n' +
      '       afterAll(() => { globalThis.ResizeObserver = original; });\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.filePath} — ${violation.reason}\n`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-test-cleanup failed:', error);
    process.exit(1);
  });
}
