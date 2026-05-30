/**
 * Playground test runner.
 *
 * Runs the playground test suite in TWO separate `bun test` processes and fails
 * if either does. This split is deliberate and load-bearing — do not collapse it
 * back into a single `bun test` invocation without re-measuring.
 *
 * The ONE constraint that forces it (reproducibly verified, May 2026):
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
 * Isolating exactly `component-page.test.ts` is sufficient: every other test
 * file (including `server.test.ts` and the other DOM-mount tests) coexists
 * cleanly in one process.
 */

const TEST_ENV = {
  ...process.env,
  TZ: 'UTC',
  LANG: 'en_US.UTF-8',
};

// `--parallel=1` (serial) is required, same as the components package: Bun's
// parallel runner uses worker processes that race to import the Svelte test
// stack at module-init and deadlock, and the iframe-driven preview-frame tests
// hit happy-dom `postMessage` cross-origin errors when multiple windows run
// concurrently. Serial execution avoids both. Do not strip without re-measuring.
const SHARED_FLAGS = ['--conditions', 'browser', '--conditions', 'svelte', '--parallel=1'];

/** The mount-heavy file that must run alone (see module header). */
const ISOLATED_TEST = 'src/component-page.test.ts';

/**
 * Run one `bun test` invocation with the shared flags plus `args` (a path glob
 * to include, or a `--path-ignore-patterns=...` to exclude). Inherits stdio so
 * the child's reporter streams straight through. Returns its exit code.
 */
async function runBunTest(args: string[]): Promise<number> {
  const child = Bun.spawn(['bun', 'test', ...SHARED_FLAGS, ...args], {
    env: TEST_ENV,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return child.exited;
}

/** Run both test processes in sequence; exit non-zero if either fails. */
async function main(): Promise<void> {
  // Process 1: everything EXCEPT the isolated mount test.
  const mainExit = await runBunTest([`--path-ignore-patterns=${ISOLATED_TEST}`]);
  // Process 2: only the isolated mount test.
  const isolatedExit = await runBunTest([ISOLATED_TEST]);
  process.exit(mainExit !== 0 || isolatedExit !== 0 ? 1 : 0);
}

// Fire-and-forget: `main()` calls `process.exit`, so the process ends inside it.
// Surface an unexpected rejection as a non-zero exit rather than an unhandled one.
void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
