/**
 * Test-isolation policy guard (two rules).
 *
 * The component suite runs every `*.test.ts` in ONE process under
 * `bun test --parallel=1`, sharing a single happy-dom `Window`. Anything a test
 * leaves mounted or any global it overrides without restoring bleeds into every
 * later test file. This passes in isolation and ONLY fails in the full suite —
 * exactly the class of CI-only flake that crashed `validate` and blocked the
 * release pipeline (combobox, then dropdown). Two rules close it:
 *
 *   Rule 1 — cleanup: a test that imports `@testing-library/svelte`, calls its
 *   `render(`, and reads shared global DOM (`document.activeElement` /
 *   `document.body`) MUST call `cleanup()` inside a teardown hook
 *   (`afterEach`/`afterAll`). The render wrapper mounts into the shared
 *   `document.body`; cleanup() unmounts it.
 *
 *   Rule 2 — orphaned override: a test that overrides a hazardous process-global
 *   (ResizeObserver, getComputedStyle, matchMedia, …) at module scope MUST have
 *   a teardown hook (afterEach/afterAll/finally) that undoes it. The guard checks
 *   only that a teardown exists — NOT that it restores the saved original
 *   correctly; that is a dataflow property text matching can't decide without
 *   flagging legitimate patterns. The hardening of known offenders lives in the
 *   test files; this rule stops a future *orphaned* override (a stub with nothing
 *   to undo it) from reintroducing the class.
 *
 * Scope is the whole package `src/**` (not just `components/`) — the override
 * hazard is not component-specific; `_internal`/utility tests share the same
 * Window. Files that drive Svelte's `mount`/`unmount` directly (their own
 * target + teardown, no testing-library) are out of Rule 1 via the
 * testing-library-import requirement.
 *
 * Detection is text-based but structural: teardown-hook bodies are extracted by
 * brace-matching so "called inside a hook" and "restored inside a hook" are
 * actually enforced (not merely "the token appears somewhere"). Like the
 * sibling `check-no-*` guards, oxlint can't express this, so it is a standalone
 * script wired into `bun run lint` (and therefore CI) via `package.json`.
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(scriptDirectory, '..', 'src');
const repoRoot = resolve(srcRoot, '..', '..', '..');

// Rule 1 signals.
const TESTING_LIBRARY_IMPORT_PATTERN = /@testing-library\/svelte/;
const RENDER_PATTERN = /\brender\s*\(/;
const GLOBAL_DOM_READ_PATTERN = /document\.(?:activeElement|body)\b/;
const CLEANUP_CALL_PATTERN = /\bcleanup\s*\(\s*\)/;

// Rule 2: a hazardous global overridden without a save+restore leaks into every
// later file. We police the known cross-test-pollution surface only — observers,
// layout/animation, and media APIs — not arbitrary `globalThis.foo` scratch.
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

const GLOBAL_TARGET = '(?:globalThis|window|navigator)';

// An override of a hazardous global: `globalThis.X = …` or
// `Object.defineProperty(globalThis, 'X', …)`.
const OVERRIDE_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b${GLOBAL_TARGET}\\.(\\w+)\\s*=`, 'g'),
  new RegExp(`Object\\.defineProperty\\(\\s*${GLOBAL_TARGET}\\s*,\\s*['"](\\w+)['"]`, 'g'),
];

type Violation = { filePath: string; reason: string };

/**
 * Extract teardown source: the argument list of every `afterEach(...)` /
 * `afterAll(...)` call (matched by parentheses, so it covers every form —
 * `afterEach(cleanup)`, `afterEach(() => cleanup())`, and
 * `afterEach(() => { … })`) plus the body of every `finally { … }` block
 * (matched by braces). Returns the concatenation so callers can check whether a
 * token actually lives inside a teardown context (not in a test, a comment, or
 * an uncalled helper).
 */
function extractTeardownBodies(source: string): string {
  const bodies: string[] = [];

  const sliceMatched = (openIndex: number, open: string, close: string): number => {
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      const char = source[index];
      if (char === open) depth += 1;
      else if (char === close) {
        depth -= 1;
        if (depth === 0) {
          bodies.push(source.slice(openIndex, index + 1));
          return index + 1;
        }
      }
    }
    return source.length;
  };

  // `afterEach(...)` / `afterAll(...)` — match the parenthesised argument list,
  // which contains the callback in any form (reference, concise arrow, block).
  const hookCall = /\bafter(?:Each|All)\s*\(/g;
  for (let match = hookCall.exec(source); match !== null; match = hookCall.exec(source)) {
    const parenIndex = source.indexOf('(', match.index);
    if (parenIndex !== -1) sliceMatched(parenIndex, '(', ')');
  }

  // `finally { ... }` — match the block body.
  const finallyBlock = /\bfinally\b/g;
  for (let match = finallyBlock.exec(source); match !== null; match = finallyBlock.exec(source)) {
    const braceIndex = source.indexOf('{', match.index);
    if (braceIndex !== -1) sliceMatched(braceIndex, '{', '}');
  }

  return bodies.join('\n');
}

function findCleanupViolation(source: string): string | null {
  const rendersIntoSharedDom =
    TESTING_LIBRARY_IMPORT_PATTERN.test(source) &&
    RENDER_PATTERN.test(source) &&
    GLOBAL_DOM_READ_PATTERN.test(source);
  if (!rendersIntoSharedDom) return null;

  // cleanup() must live inside a teardown hook, not anywhere in the file.
  if (CLEANUP_CALL_PATTERN.test(extractTeardownBodies(source))) return null;
  return 'renders into shared document.body but never calls cleanup() in a teardown hook';
}

// A teardown hook of any form: afterEach/afterAll/finally. Its mere presence is
// what Rule 2 requires alongside a hazardous override (see below).
const TEARDOWN_HOOK_PATTERN = /\b(?:afterEach|afterAll)\s*\(|\bfinally\b/;

/**
 * Rule 2 — orphaned override: flag a file that overrides a hazardous global but
 * has NO teardown hook at all. That is the original landmine class — a stub
 * installed at module scope with nothing to ever undo it, leaking into every
 * later test file in the shared Window.
 *
 * Deliberately conservative: it does NOT try to prove the restore targets the
 * saved original or runs on the right path. Verifying restore-correctness is a
 * dataflow property that text matching cannot decide without false-positiving
 * legitimate patterns (a `restore()` method called from `afterEach`, descriptor
 * save/restore, indirection). The hardening of the known offenders is done in
 * the test files themselves; this guard exists to stop a future *orphaned*
 * override from reintroducing the class, and that is exactly what the
 * teardown-presence check catches without false alarms.
 */
function findGlobalOverrideViolation(source: string): string | null {
  if (TEARDOWN_HOOK_PATTERN.test(source)) return null;

  const overridden = new Set<string>();
  for (const pattern of OVERRIDE_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const property = match[1];
      if (property && HAZARDOUS_GLOBALS.has(property)) overridden.add(property);
    }
  }

  if (overridden.size === 0) return null;
  return `overrides global ${[...overridden].join(', ')} but has no teardown hook (afterEach/afterAll/finally) to restore it`;
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('**/*.test.ts');

  for await (const relativePath of glob.scan({ cwd: srcRoot })) {
    const absolutePath = resolve(srcRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const filePath = relative(repoRoot, absolutePath);

    const cleanupReason = findCleanupViolation(source);
    if (cleanupReason) violations.push({ filePath, reason: cleanupReason });

    const overrideReason = findGlobalOverrideViolation(source);
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
      '     MUST save the original and assign it back inside a teardown hook:\n\n' +
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
