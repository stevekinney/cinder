/**
 * Test-isolation policy guard (three rules).
 *
 * The suite runs every `*.test.ts` in ONE process under `bun test --parallel=1`,
 * sharing a single happy-dom `Window`. Anything a test leaves mounted, or any
 * global it overrides without restoring, bleeds into every later test file. This
 * passes in isolation and ONLY fails in the full suite — exactly the class of
 * CI-only flake that crashed `validate` and blocked the release pipeline
 * (combobox, then dropdown). Three rules close it:
 *
 *   Rule 1 — cleanup: a test that imports `@testing-library/svelte`, calls its
 *   `render(`, and reads shared global DOM (`document.activeElement` /
 *   `document.body`) MUST reference `cleanup` inside a teardown hook
 *   (`afterEach`/`afterAll`) — either `afterEach(cleanup)` or a call to
 *   `cleanup()` in the hook body.
 *
 *   NOTE: as of the global-cleanup fix below, `scripts/preload.ts` registers a
 *   package-wide `afterEach(cleanup)` before any test file loads, so this
 *   per-file rule is now belt-and-suspenders rather than load-bearing — the
 *   ~90 existing test files that satisfy it are redundant but harmless, and
 *   this script does not mass-edit them.
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
 *   Rule 3 — global cleanup registration: `scripts/preload.ts` (the file every
 *   test process loads before any test file, per `bunfig.toml`'s `[test]
 *   preload`) MUST register a package-wide `afterEach(cleanup)` for
 *   `@testing-library/svelte`, via `src/test/register-global-cleanup.ts`. Without
 *   it, mounted trees from `render()` calls across the ~90 component test files
 *   accumulate for the life of the process — the multi-gigabyte RSS this guard
 *   exists to prevent recurring. This rule fails if the registration call is
 *   removed from preload, or if `register-global-cleanup.ts` stops calling
 *   `afterEach` with something that references `cleanup`.
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
const packageRoot = resolve(scriptDirectory, '..');
const srcRoot = resolve(packageRoot, 'src');
const repoRoot = resolve(srcRoot, '..', '..', '..');

const preloadPath = resolve(packageRoot, 'scripts', 'preload.ts');
const globalCleanupPath = resolve(srcRoot, 'test', 'register-global-cleanup.ts');

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

/** Does any node in `root`'s subtree reference an identifier with the given name? */
function subtreeReferencesIdentifier(root: ts.Node, name: string): boolean {
  let found = false;
  walk(root, (node) => {
    if (ts.isIdentifier(node) && node.text === name) found = true;
  });
  return found;
}

/**
 * Rule 3: `register-global-cleanup.ts` must register an `afterEach` hook whose
 * argument references `cleanup` — the package-wide teardown that replaces the
 * ~90 files' worth of per-file cleanup boilerplate. Checked independently of
 * Rule 1's per-file AST walk because this is a single, specific file, not a
 * glob over the whole suite.
 */
async function findGlobalCleanupRegistrationViolation(): Promise<string | null> {
  const file = Bun.file(globalCleanupPath);
  if (!(await file.exists())) {
    return `${relative(repoRoot, globalCleanupPath)} is missing — the package-wide afterEach(cleanup) registration is gone`;
  }
  const source = await file.text();
  const sourceFile = parse(source, globalCleanupPath);

  let registersCleanup = false;
  walk(sourceFile, (node) => {
    if (
      isTeardownHookCall(node) &&
      node.arguments.some((argument) => subtreeReferencesIdentifier(argument, 'cleanup'))
    ) {
      registersCleanup = true;
    }
  });
  if (!registersCleanup) {
    return `${relative(repoRoot, globalCleanupPath)} no longer registers afterEach(cleanup) — the package-wide teardown is gone`;
  }
  return null;
}

/**
 * Rule 3 (continued): `scripts/preload.ts` — the file `bunfig.toml`'s
 * `[test] preload` loads before any test file — must actually invoke the
 * global-cleanup registration. Without this call, `register-global-cleanup.ts`
 * existing and being correct is moot: nothing ever runs it.
 */
async function findPreloadWiringViolation(): Promise<string | null> {
  const file = Bun.file(preloadPath);
  if (!(await file.exists())) {
    return `${relative(repoRoot, preloadPath)} is missing`;
  }
  const source = await file.text();
  const sourceFile = parse(source, preloadPath);

  // A real, executed call — `registerGlobalCleanup(...)` — as a statement (bare
  // or awaited), not merely an import or a reference inside a comment/string.
  let invokesRegistration = false;
  walk(sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'registerGlobalCleanup'
    ) {
      invokesRegistration = true;
    }
  });
  if (!invokesRegistration) {
    return `${relative(repoRoot, preloadPath)} no longer calls registerGlobalCleanup() — the package-wide afterEach(cleanup) never gets registered`;
  }
  return null;
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

  const globalCleanupReason = await findGlobalCleanupRegistrationViolation();
  if (globalCleanupReason) {
    violations.push({
      filePath: relative(repoRoot, globalCleanupPath),
      reason: globalCleanupReason,
    });
  }

  const preloadWiringReason = await findPreloadWiringViolation();
  if (preloadWiringReason) {
    violations.push({ filePath: relative(repoRoot, preloadPath), reason: preloadWiringReason });
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
      'flakes on CI. Three rules:\n\n' +
      '  1. A test that renders via @testing-library/svelte and reads document.activeElement/\n' +
      '     document.body MUST call cleanup() inside an afterEach/afterAll.\n' +
      '  2. A test that overrides a global (ResizeObserver, getComputedStyle, matchMedia, …)\n' +
      '     MUST save the original and restore it inside a teardown hook:\n\n' +
      '       const original = globalThis.ResizeObserver;\n' +
      '       globalThis.ResizeObserver = Stub;\n' +
      '       afterAll(() => { globalThis.ResizeObserver = original; });\n\n' +
      '  3. scripts/preload.ts MUST call registerGlobalCleanup() from\n' +
      '     src/test/register-global-cleanup.ts, which MUST register\n' +
      '     afterEach(cleanup) for @testing-library/svelte — the package-wide\n' +
      '     teardown that unmounts every render() across the whole suite.\n\n',
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
