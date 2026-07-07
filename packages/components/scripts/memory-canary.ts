/**
 * Memory canary — non-blocking peak-RSS trend signal for a representative
 * slice of component suites.
 *
 * This exists to make memory trends VISIBLE, not to gate anything. The
 * streamlining batch that preceded this script fixed a multi-gigabyte RSS
 * blowup from the same suite running redundantly across layers plus
 * unbounded `render()` accumulation across the process-shared happy-dom
 * Window; a global `afterEach(cleanup)` (see `register-global-cleanup.ts`)
 * and the layer de-duplication now keep that from recurring. This canary is
 * the tripwire that would show a regression trending back upward BEFORE it
 * turns into another multi-gigabyte incident — but a single noisy run must
 * never flake CI, so it always exits 0 for the *number*, and only exits 1 if
 * the test process itself fails.
 *
 * Runs `bun test --conditions browser --conditions svelte <dirs>` for a fixed
 * set of diverse component suites via `Bun.spawn`, reads the child's peak RSS
 * from `Bun.Subprocess.resourceUsage()` after it exits (no polling — no
 * sampling race), and prints one line:
 *
 *   memory-canary: peak RSS <N> MB over <M> suites
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');

/**
 * A fixed, diverse slice of component suites: a simple leaf (card), a
 * data-heavy/virtualized component (data-table), a floating/async-search
 * component (combobox), a compound multi-file component with streaming state
 * (chat), a floating-UI positioning component (tooltip), and a floating
 * list/menu component (dropdown). Deliberately NOT derived from a diff or
 * component count — this is a fixed representative sample so the number is
 * comparable run over run.
 */
export const CANARY_COMPONENT_SLUGS = [
  'card',
  'data-table',
  'combobox',
  'chat',
  'tooltip',
  'dropdown',
] as const;

const BUN_TEST_FLAGS = ['--conditions', 'browser', '--conditions', 'svelte', '--parallel=1'];

function componentTestDirectories(slugs: readonly string[]): string[] {
  return slugs.map((slug) => join('src', 'components', slug));
}

export type CanaryResult = {
  /** Peak RSS across the child test process, normalized to bytes (see {@link bytesFromMaxRss}). */
  peakRssBytes: number;
  exitCode: number;
};

/**
 * Run `bun test` over the given component directories and report the child's
 * peak RSS, normalized to bytes regardless of platform.
 */
export async function runMemoryCanary(
  slugs: readonly string[] = CANARY_COMPONENT_SLUGS,
): Promise<CanaryResult> {
  const directories = componentTestDirectories(slugs);
  const child = Bun.spawn(['bun', 'test', ...BUN_TEST_FLAGS, ...directories], {
    cwd: packageRoot,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
  });

  const exitCode = await child.exited;
  // `resourceUsage()` is only populated once the process has exited; reading
  // it before `exited` resolves would race the child's own accounting.
  const usage = child.resourceUsage();
  const peakRssBytes = bytesFromMaxRss(usage?.maxRSS ?? 0);

  return { peakRssBytes, exitCode };
}

/**
 * `resourceUsage().maxRSS` reports `getrusage`'s `ru_maxrss` verbatim, whose
 * unit is platform-dependent: bytes on Darwin/macOS, kibibytes on Linux
 * (glibc). CI (`main-green.yaml`) runs on `ubuntu-latest`; local development on
 * this repo runs on macOS. Detect via `process.platform` rather than assuming
 * either unit, so the printed megabyte figure is correct on both.
 */
function bytesFromMaxRss(maxRss: number): number {
  return process.platform === 'darwin' ? maxRss : maxRss * 1024;
}

function bytesToMegabytes(bytes: number): number {
  return bytes / 1024 / 1024;
}

async function main(): Promise<void> {
  const result = await runMemoryCanary();
  const peakMegabytes = bytesToMegabytes(result.peakRssBytes);
  const summary = `memory-canary: peak RSS ${peakMegabytes.toFixed(1)} MB over ${CANARY_COMPONENT_SLUGS.length} suites`;
  console.log(summary);

  // GitHub Actions treats $GITHUB_STEP_SUMMARY as an append-only Markdown file
  // (`>>` in the workflow step). Mirror that from here too: read-then-append,
  // so the number lands in the job summary without clobbering earlier steps'
  // output. Best-effort — a write failure here must never fail the canary.
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryPath) {
    try {
      const existing = (await Bun.file(summaryPath).exists())
        ? await Bun.file(summaryPath).text()
        : '';
      await Bun.write(summaryPath, `${existing}${summary}\n`);
    } catch {
      // Non-fatal: the console line above already carries the signal.
    }
  }

  // Non-blocking BY DESIGN: only a test-process failure exits non-zero. The
  // RSS number itself never gates.
  if (result.exitCode !== 0) {
    console.error(`memory-canary: underlying test run failed (exit ${result.exitCode})`);
    process.exit(result.exitCode);
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('memory-canary failed:', error);
    process.exit(1);
  });
}
