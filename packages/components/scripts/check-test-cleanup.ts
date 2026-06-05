/**
 * Test-isolation policy guard (two rules).
 *
 * Rule 1 — cleanup: a test rendering via @testing-library/svelte that reads
 * shared global DOM must call cleanup() (see below).
 * Rule 2 — global restore: a test that overrides a process-global API
 * (ResizeObserver/IntersectionObserver/getComputedStyle/matchMedia/rAF…) at
 * module scope must save the original and restore it in afterAll/afterEach/
 * finally. The suite shares ONE Window across all files under --parallel=1, so
 * an unrestored override leaks the stub into every later test file — an ordering
 * landmine that passes today and detonates when file order shifts.
 *
 * Component tests render into the shared global `document.body` (the test
 * harness installs a single happy-dom Window for the whole suite, and the
 * common `render` wrapper returns `container: document.body`). If a test file
 * never calls `@testing-library/svelte`'s `cleanup()`, prior renders stay
 * mounted between tests, and reads of shared global state —
 * `document.activeElement`, `document.body.querySelector(...)` — pick up another
 * test's markup. This fails ONLY in the full suite (where ordering leaks state
 * across files), passes in isolation, and is therefore invisible locally and
 * only surfaces on CI — exactly the class of flake that crashed `validate` and
 * blocked the release pipeline (combobox, then dropdown).
 *
 * The rule: any `*.test.ts` under `src/components/` that imports
 * `@testing-library/svelte`, calls its `render(`, AND reads shared global DOM
 * state (`document.activeElement` or `document.body`) MUST call `cleanup()`
 * somewhere. `cleanup()` belongs in an `afterEach` (often alongside other
 * teardown); this guard only checks that it is called, not where. Files that
 * drive Svelte's `mount`/`unmount` directly (managing their own target and
 * teardown) are out of scope — they don't use testing-library's shared-body
 * render, so the testing-library import requirement excludes them.
 *
 * Whole-file matching (not line-based) so it survives Prettier reformatting.
 * Like the sibling `check-no-*` guards, oxlint can't express this, so it is a
 * standalone script wired into `bun run lint` (and therefore CI) via
 * `package.json`.
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(scriptDirectory, '..', 'src');
const componentsRoot = resolve(srcRoot, 'components');
const repoRoot = resolve(srcRoot, '..', '..', '..');

// The guard targets the testing-library `render` idiom specifically: those
// renders mount into the shared global `document.body` and are torn down by
// `cleanup()`. Files that drive `mount`/`unmount` from `svelte` directly manage
// their own target and lifecycle (and call `unmount()` themselves), so they are
// out of scope — requiring a testing-library import keeps them out.
const TESTING_LIBRARY_IMPORT_PATTERN = /@testing-library\/svelte/;

// A testing-library render. The optional-chaining/await forms are covered by
// the loose `\(`.
const RENDER_PATTERN = /\brender\s*\(/;

// Shared global DOM reads that cross-test pollution corrupts. `document.body`
// also covers the `container: document.body` render-wrapper idiom.
const GLOBAL_DOM_READ_PATTERN = /document\.(?:activeElement|body)\b/;

// The fix: a call to testing-library's `cleanup()`.
const CLEANUP_CALL_PATTERN = /\bcleanup\s*\(\s*\)/;

// Process-global APIs that a test commonly overrides because happy-dom lacks
// them or to control behavior. Overriding any of these at module scope without
// restoring the original leaks the stub into EVERY later test file in the
// single shared Window — an ordering landmine that passes today and detonates
// when file order shifts. Each must be saved and restored (afterAll/afterEach/
// finally). The capture group is the property name we then require to be
// restored.
const GLOBAL_OVERRIDE_PATTERNS: readonly RegExp[] = [
  // `globalThis.X = ...` / `window.X = ...`
  /\b(?:globalThis|window|navigator)\.(\w+)\s*=/g,
  // `Object.defineProperty(globalThis, 'X', ...)` / (window, "X", ...)
  /Object\.defineProperty\(\s*(?:globalThis|window|navigator)\s*,\s*['"](\w+)['"]/g,
];

// Properties that are reassigned all the time as ordinary local bookkeeping and
// are NOT shared-global hazards (e.g. `window.location.href = …` reads through a
// sub-object; `globalThis.foo` test scratch). We only police the known
// cross-test-pollution surface — observers, layout/animation, media APIs.
const HAZARDOUS_GLOBALS = new Set<string>([
  'ResizeObserver',
  'IntersectionObserver',
  'MutationObserver',
  'getComputedStyle',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IntersectionObserverEntry',
]);

type Violation = { filePath: string; reason: string };

/**
 * A global override is "restored" if the same property name is assigned back
 * inside a teardown context. We approximate this structurally: the property
 * appears in a second assignment (`X = original` / `globalThis.X = …`) AND the
 * file contains a teardown hook (`afterAll`/`afterEach`) or a `finally` block.
 * Over-permissive by design — the goal is to catch the "no restore anywhere"
 * landmine, not to prove the restore is perfectly correct.
 */
function isRestored(source: string, property: string): boolean {
  // The restore must live in a teardown context, AND it must re-assign the
  // property back. We look for a plain `globalThis.X = …` / `window.X = …`
  // assignment that sits inside an afterAll/afterEach/finally block. (The
  // override itself may be a plain assignment OR an Object.defineProperty — we
  // don't count it here; we only need to confirm a restore exists.)
  const restoreAssignment = `(?:globalThis|window|navigator)\\.${property}\\s*=`;
  const teardownWithRestore = new RegExp(
    // after(All|Each)( … X = … )  — non-greedy across the hook body
    `\\bafter(?:All|Each)\\s*\\([\\s\\S]*?${restoreAssignment}[\\s\\S]*?\\)` +
      // …or a finally block that restores
      `|\\bfinally\\s*\\{[\\s\\S]*?${restoreAssignment}`,
  );
  return teardownWithRestore.test(source);
}

function findCleanupViolations(source: string): string | null {
  const rendersIntoSharedDom =
    TESTING_LIBRARY_IMPORT_PATTERN.test(source) &&
    RENDER_PATTERN.test(source) &&
    GLOBAL_DOM_READ_PATTERN.test(source);
  if (!rendersIntoSharedDom) return null;
  if (CLEANUP_CALL_PATTERN.test(source)) return null;
  return 'renders into shared document.body but never calls cleanup()';
}

function findGlobalOverrideViolations(source: string): string | null {
  const unrestored = new Set<string>();
  for (const pattern of GLOBAL_OVERRIDE_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const property = match[1];
      if (!property || !HAZARDOUS_GLOBALS.has(property)) continue;
      if (!isRestored(source, property)) unrestored.add(property);
    }
  }
  if (unrestored.size === 0) return null;
  return `overrides global ${[...unrestored].join(', ')} without restoring the original`;
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('**/*.test.ts');

  for await (const relativePath of glob.scan({ cwd: componentsRoot })) {
    const absolutePath = resolve(componentsRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const filePath = relative(repoRoot, absolutePath);

    const cleanupReason = findCleanupViolations(source);
    if (cleanupReason) violations.push({ filePath, reason: cleanupReason });

    const overrideReason = findGlobalOverrideViolations(source);
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
    'check-test-cleanup — test-isolation hazard(s) detected. Each component test shares one\n' +
      'process-global Window (--parallel=1), so un-torn-down state leaks into later test files\n' +
      'and flakes on CI. Two rules:\n\n' +
      '  1. A test that renders via @testing-library/svelte and reads document.activeElement/\n' +
      '     document.body MUST call cleanup() in an afterEach.\n' +
      '  2. A test that overrides a global (ResizeObserver, getComputedStyle, matchMedia, …)\n' +
      '     MUST save the original and restore it in afterAll/afterEach/finally.\n\n' +
      '  const original = globalThis.ResizeObserver;\n' +
      '  globalThis.ResizeObserver = Stub;\n' +
      '  afterAll(() => { globalThis.ResizeObserver = original; });\n\n',
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
