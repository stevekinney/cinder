/**
 * Register a global `afterEach(cleanup)` for `@testing-library/svelte` so every
 * component test's mounted tree is unmounted from the shared happy-dom document,
 * without requiring each of the ~90 test files to remember to call `cleanup()`
 * itself.
 *
 * Why this exists: `@testing-library/svelte` v5's own auto-cleanup registers via
 * a framework's native afterEach hook (Vitest/Jest globals), which Bun's test
 * runner does not provide, so it silently never registers under `bun:test`.
 * Every `render()` call within a runner process then accumulates its mounted
 * tree in that process's happy-dom `Window`, which is the direct cause of
 * multi-gigabyte RSS over a full run.
 *
 * Called once from `scripts/preload.ts`, which runs before any test file's
 * imports resolve — so this hook is registered before the first `describe`/
 * `test` in the suite, and Bun's `afterEach` semantics apply it after every
 * test in every file, not just the file that happened to register it.
 *
 * Guarded so it can't double-register (defensive; preload only runs once per
 * process) and no-ops if `@testing-library/svelte` isn't loadable in this
 * context, rather than failing every test in the run.
 */
import { afterEach } from 'bun:test';

let registered = false;

export async function registerGlobalCleanup(): Promise<void> {
  if (registered) return;
  registered = true;

  const { cleanup } = await import('@testing-library/svelte');
  afterEach(cleanup);
}
