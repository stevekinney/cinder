/**
 * Run the component unit tests scoped to the components a diff affects (the
 * changed components AND their transitive dependents), instead of the full
 * ~1000-file suite.
 *
 * Scope comes from the same dependency graph the Playwright scope job uses
 * (`component-graph.ts`): either a `CINDER_TEST_COMPONENTS` env var (a
 * comma-separated slug list, as CI sets it) or, when that is absent, computed
 * locally from `git diff` against a base ref.
 *
 * Falls back to the FULL suite whenever scope is `full` or no slugs resolve —
 * a missed edge silently skips a test, so "run everything" is the safe default.
 *
 * Test layout: each component's tests live under
 * `src/components/<slug>/**` (including nested subdirectories like
 * `chat/input/`), so scoping a slug means handing `bun test` that directory.
 * Shared test infrastructure under `src/test/**` and the scripts' own tests
 * always run, because a change anywhere can rely on them.
 *
 * Usage:
 *   bun run scripts/test-changed.ts                 # CINDER_TEST_COMPONENTS or git diff
 *   CINDER_TEST_COMPONENTS=button,badge bun run scripts/test-changed.ts
 *   bun run scripts/test-changed.ts --base origin/main
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeScope,
  loadKnownSlugs,
  loadSourceFiles,
  type ScopeDecision,
} from './component-graph.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');

/**
 * Directories whose tests ALWAYS run regardless of scope.
 *
 * `src/test` holds the shared test harness (lifecycle helpers, render
 * utilities) that component tests import; a change there is force-full anyway,
 * but its own unit tests are cheap and worth running with any scoped set.
 *
 * `scripts/` is deliberately NOT here: a component change must not drag in all
 * ~17 build/generate-tooling test files. Those tests run only when `scripts/`
 * itself changes — and a `scripts/` change force-fulls (see
 * `pathForceFullReason`), which runs them via the full suite.
 */
const ALWAYS_RUN_PATHS = ['src/test'] as const;

/** The `bun test` flags the components package uses (browser+svelte conditions). */
const BUN_TEST_FLAGS = [
  '--conditions',
  'browser',
  '--conditions',
  'svelte',
  '--parallel=1',
] as const;

/**
 * Map a scope decision to the positional path arguments for `bun test`.
 *
 * Returns `null` to signal "run the full suite" (no positional filters). A
 * filtered decision returns the always-run shared dirs plus one directory per
 * scoped slug. Pure + exported for unit testing.
 */
export function testPathsForScope(decision: ScopeDecision): string[] | null {
  if (decision.mode === 'full') return null;
  if (decision.slugs.length === 0) return null;

  const paths: string[] = [...ALWAYS_RUN_PATHS];
  for (const slug of decision.slugs) {
    paths.push(`src/components/${slug}`);
  }
  return paths;
}

/** Parse the `CINDER_TEST_COMPONENTS` env var into a slug list (empty = unset). */
export function parseEnvSlugs(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => slug.length > 0);
}

/** Resolve the scope decision: env var first, else `git diff` against the base. */
async function resolveScope(baseRef: string): Promise<ScopeDecision> {
  // CI sets CINDER_TEST_MODE explicitly. `full` short-circuits to the full
  // suite WITHOUT touching git — the CI checkout is shallow, so the git-diff
  // fallback below would be unreliable there. This makes "CI says full" an
  // explicit signal rather than inferring it from an empty component list.
  if (process.env['CINDER_TEST_MODE'] === 'full') {
    return { mode: 'full', reason: 'CINDER_TEST_MODE=full' };
  }

  const envSlugs = parseEnvSlugs(process.env['CINDER_TEST_COMPONENTS']);
  if (envSlugs.length > 0) {
    // CI already computed the scope; trust it. Validate against known slugs so a
    // stale/typo'd value fails loud rather than silently testing nothing.
    const knownSlugs = await loadKnownSlugs();
    const unknown = envSlugs.filter((slug) => !knownSlugs.has(slug));
    if (unknown.length > 0) {
      throw new Error(
        `CINDER_TEST_COMPONENTS has unknown slug(s): ${unknown.toSorted().join(', ')}`,
      );
    }
    return { mode: 'filtered', slugs: [...envSlugs].toSorted() };
  }

  // No env scope: compute from the working tree's diff against the base.
  const diff = Bun.spawnSync(['git', 'diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: workspaceRoot,
  });
  // A failed git invocation (e.g. base ref not fetched on a shallow clone) must
  // NOT be misread as "empty diff → full". Surface it as full WITH the reason,
  // so the run is safe (full) and the failure is visible in the log rather than
  // silently swallowed. This path is local-only; CI sets CINDER_TEST_MODE.
  if (diff.exitCode !== 0) {
    const stderr = new TextDecoder().decode(diff.stderr).trim();
    return {
      mode: 'full',
      reason: `git diff against '${baseRef}' failed (running full): ${stderr || `exit ${diff.exitCode}`}`,
    };
  }
  const changedFiles = new TextDecoder()
    .decode(diff.stdout)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (changedFiles.length === 0) {
    return { mode: 'full', reason: 'no diff against base — running full suite' };
  }

  // Detect deletions/renames by disk absence rather than `--diff-filter=D`:
  // without `-M`, a rename reports only the new path under D, so the old
  // (source) side would be missed. A changed path absent at HEAD is gone,
  // however it was removed. Mirrors changed-components.ts.
  const deletedFiles = changedFiles.filter((file) => !existsSync(join(workspaceRoot, file)));

  const [sourceFiles, knownSlugs] = await Promise.all([loadSourceFiles(), loadKnownSlugs()]);
  return computeScope({ changedFiles, deletedFiles, sourceFiles, knownSlugs });
}

function parseBaseRef(argv: string[]): string {
  const index = argv.indexOf('--base');
  if (index !== -1 && argv[index + 1] !== undefined) return argv[index + 1]!;
  return 'origin/main';
}

async function main(): Promise<void> {
  const baseRef = parseBaseRef(process.argv.slice(2));
  const decision = await resolveScope(baseRef);
  const paths = testPathsForScope(decision);

  if (paths === null) {
    const reason = decision.mode === 'full' ? decision.reason : 'no scoped slugs';
    process.stderr.write(`test-changed: full suite (${reason})\n`);
  } else {
    process.stderr.write(
      `test-changed: ${decision.mode === 'filtered' ? decision.slugs.length : 0} component(s): ` +
        `${decision.mode === 'filtered' ? decision.slugs.join(', ') : ''}\n`,
    );
  }

  const positional = paths ?? [];
  const child = Bun.spawn(['bun', 'test', ...BUN_TEST_FLAGS, ...positional], {
    cwd: packageRoot,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, TZ: 'UTC', LANG: 'en_US.UTF-8' },
  });
  const exitCode = await child.exited;
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`test-changed failed: ${String(error)}\n`);
    process.exit(1);
  });
}
