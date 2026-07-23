/**
 * Playground test runner.
 *
 * Runs the playground test suite across deliberately isolated `bun test`
 * processes and fails if any process does. This split is load-bearing — do not
 * collapse it back into a single `bun test` invocation without re-measuring.
 *
 * Two constraints force it (reproducibly verified in CI):
 *
 *   `component-page.test.ts` imperatively `mount()`s Svelte fixtures (it exercises
 *   the example-mount `$effect`). Once those fixtures have been compiled and
 *   mounted in a process, the global Svelte runtime / Bun bundler module state is
 *   left in a shape that makes a LATER `Bun.build` of a real component
 *   (`server.test.ts`'s `/page-bundle/chat.js` route) fail to read Svelte's
 *   internal sources — surfacing as `Unexpected reading file:
 *   svelte/src/internal/client/index.js` and `Unexpected type` on a `.ts`
 *   re-export. Both files pass in isolation; only the same-process combination
 *   breaks. `--parallel=1` does not help (the corruption is shared-process, not a
 *   parallel race), so the only robust fix is to run the mount-heavy test in its
 *   own process, away from the build-driving server tests.
 *
 *   Tests that drive `Bun.build()` must also start in a fresh process. A
 *   previously healthy shared process failed later builds with
 *   `Unexpected reading file` / `Unseekable reading file` errors against
 *   healthy component source files on Linux CI (July 2026). Each build-driving
 *   file passes in isolation.
 *
 * The runner discovers build-driving tests from direct `Bun.build()` calls and
 * imports of the server/export build pipelines, so a new test cannot silently
 * join the shared process and recreate this failure mode.
 */

import { resolve } from 'node:path';

const TEST_ENV = {
  ...process.env,
  TZ: 'UTC',
  LANG: 'en_US.UTF-8',
};

const PLAYGROUND_ROOT = resolve(import.meta.dir, '..');
const TEST_DIRECTORIES = ['scripts', 'src'] as const;

// `--parallel=1` (serial) is required, same as the components package: Bun's
// parallel runner uses worker processes that race to import the Svelte test
// stack at module-init and deadlock, and the iframe-driven preview-frame tests
// hit happy-dom `postMessage` cross-origin errors when multiple windows run
// concurrently. Serial execution avoids both. Do not strip without re-measuring.
const SHARED_FLAGS = ['--conditions', 'browser', '--conditions', 'svelte', '--parallel=1'];

const MOUNT_HEAVY_TEST = 'src/component-page.test.ts';

/**
 * Imports and APIs that cause a test to drive the playground's `Bun.build()`
 * pipeline.
 * Matching is intentionally conservative: an extra fresh process is cheap,
 * while letting one build-driving test share poisoned process state is not.
 */
const BUILD_DRIVER_PATTERN =
  /\bBun\.build\b|(?:from\s+|import\(\s*)['"][^'"]*(?:playground-server|static-export)\.ts['"]/;

export type PlaygroundTestFile = {
  path: string;
  source: string;
};

/** Return whether a test file requires a fresh Bun process. */
export function requiresFreshProcess(testFile: PlaygroundTestFile): boolean {
  return testFile.path === MOUNT_HEAVY_TEST || BUILD_DRIVER_PATTERN.test(testFile.source);
}

/**
 * Build the process plan: safe tests share one serial process, while every
 * state-sensitive test receives its own process.
 */
export function createTestProcessPlan(testFiles: PlaygroundTestFile[]): string[][] {
  const sortedTestFiles = testFiles.toSorted((left, right) => left.path.localeCompare(right.path));
  const sharedTestPaths = sortedTestFiles
    .filter((testFile) => !requiresFreshProcess(testFile))
    .map((testFile) => testFile.path);
  const isolatedTestPaths = sortedTestFiles
    .filter(requiresFreshProcess)
    .map((testFile) => [testFile.path]);

  return sharedTestPaths.length === 0 ? isolatedTestPaths : [sharedTestPaths, ...isolatedTestPaths];
}

/** Discover every playground test and load enough source to classify it. */
async function discoverTestFiles(): Promise<PlaygroundTestFile[]> {
  const testFiles: PlaygroundTestFile[] = [];

  for (const directory of TEST_DIRECTORIES) {
    const directoryPath = resolve(PLAYGROUND_ROOT, directory);
    const glob = new Bun.Glob('**/*.test.ts');

    for await (const relativePath of glob.scan({ cwd: directoryPath, onlyFiles: true })) {
      const path = `${directory}/${relativePath}`;
      testFiles.push({
        path,
        source: await Bun.file(resolve(PLAYGROUND_ROOT, path)).text(),
      });
    }
  }

  return testFiles;
}

/**
 * Run one `bun test` invocation for a process group. Inherits stdio so the
 * child's reporter streams straight through. Returns its exit code.
 */
async function runBunTest(args: string[]): Promise<number> {
  const child = Bun.spawn(['bun', 'test', ...SHARED_FLAGS, ...args], {
    cwd: PLAYGROUND_ROOT,
    env: TEST_ENV,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return child.exited;
}

/** Run every test process in sequence; exit non-zero if any process fails. */
async function main(): Promise<void> {
  const processPlan = createTestProcessPlan(await discoverTestFiles());
  if (processPlan.length === 0) {
    throw new Error('No playground tests were discovered.');
  }
  let failed = false;

  for (const testPaths of processPlan) {
    failed = (await runBunTest(testPaths)) !== 0 || failed;
  }

  process.exit(failed ? 1 : 0);
}

if (import.meta.main) {
  // Fire-and-forget: `main()` calls `process.exit`, so the process ends inside it.
  // Surface an unexpected rejection as a non-zero exit rather than an unhandled one.
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
