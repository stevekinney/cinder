/**
 * Test-cleanup policy guard.
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

type Violation = { filePath: string };

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('**/*.test.ts');

  for await (const relativePath of glob.scan({ cwd: componentsRoot })) {
    const absolutePath = resolve(componentsRoot, relativePath);
    const source = await Bun.file(absolutePath).text();

    const rendersIntoSharedDom =
      TESTING_LIBRARY_IMPORT_PATTERN.test(source) &&
      RENDER_PATTERN.test(source) &&
      GLOBAL_DOM_READ_PATTERN.test(source);
    if (!rendersIntoSharedDom) continue;
    if (CLEANUP_CALL_PATTERN.test(source)) continue;

    violations.push({ filePath: relative(repoRoot, absolutePath) });
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await scan();
  if (violations.length === 0) {
    process.stdout.write(
      'check-test-cleanup — OK (component tests reading shared global DOM call cleanup()).\n',
    );
    return;
  }

  process.stderr.write(
    'check-test-cleanup — component test renders into the shared document.body and reads\n' +
      'global DOM state (document.activeElement / document.body) but never calls cleanup().\n' +
      "Add `cleanup` from '@testing-library/svelte' and call it in an afterEach so renders\n" +
      'are unmounted between tests — otherwise stale nodes leak across the full suite and\n' +
      'flake on CI. Pattern:\n\n' +
      "  const { render, cleanup } = await import('@testing-library/svelte');\n" +
      '  afterEach(() => {\n' +
      '    cleanup();\n' +
      '    document.body.replaceChildren();\n' +
      '  });\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.filePath}\n`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-test-cleanup failed:', error);
    process.exit(1);
  });
}
