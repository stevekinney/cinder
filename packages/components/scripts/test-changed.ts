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
import {
  error,
  installHookProcessCleanup,
  runHookCommand,
  withLocalValidationGateLock,
} from './husky/utilities.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');

/**
 * Paths whose tests ALWAYS run with any filtered (scoped) set.
 *
 * A filtered decision widens component slugs when a SHARED module changes
 * (`utilities/`, `_internal/`, `highlighters/`, `schema-types.ts`, etc.) — but
 * the shared module's OWN tests, and the package-level invariant tests
 * (`exports-drift`, `api-contract`, `manifest`, `tree-shake`, …), live OUTSIDE
 * any `src/components/<slug>/` dir. Without these, a scoped run could pass while
 * a shared module or the export surface is broken (the slugs widened, but only
 * the component dirs were tested). So every scoped run also runs:
 *   - the shared test harness + shared-source dirs (cheap unit tests), and
 *   - the package-level invariant tests directly under `src/`.
 *
 * `scripts/` is deliberately NOT here: a component change must not drag in all
 * ~17 build/generate-tooling test files. Those run only when `scripts/` itself
 * changes — and a `scripts/` change force-fulls (see `pathForceFullReason`),
 * which runs them via the full suite.
 */
const ALWAYS_RUN_PATHS = [
  'src/test',
  'src/utilities',
  'src/_internal',
  'src/highlighters',
  'src/schemas',
  'src/styles',
] as const;

/**
 * Package-level invariant test files that sit directly under `src/` (not in a
 * component dir). These guard the export surface, manifest, and conventions —
 * exactly the things a shared-module change can break — so they run with every
 * scoped set. Listed explicitly (not by dir) because `src/` itself recurses
 * into every component.
 */
const ALWAYS_RUN_ROOT_TESTS = [
  'src/api-contract.test.ts',
  'src/components.test.ts',
  'src/compound-leaf-import-boundary.test.ts',
  'src/compound-namespace.test.ts',
  'src/convention.test.ts',
  'src/domain-suite.test.ts',
  'src/experimental-aliases.test.ts',
  'src/exports-drift.test.ts',
  'src/index.test.ts',
  'src/manifest.test.ts',
  'src/root-type-exports.test.ts',
  'src/tree-shake.test.ts',
] as const;

/**
 * Test files under `src/components/` that are not owned by public component
 * slugs returned from `loadKnownSlugs()`. They still belong to the full suite.
 */
const FULL_SUITE_PRIVATE_COMPONENT_TESTS = [
  'src/components/_internal/create-sliding-dialog-state.test.ts',
  'src/components/_radio/radio.test.ts',
  'src/components/_timeline-item/timeline-item.test.ts',
  'src/components/_timeline-item/timeline-item.types.test.ts',
  'src/components/_tree-select-all/tree-select-all.test.ts',
  'src/components/_visually-hidden-live-region.test.ts',
  'src/components/icons/index.test.ts',
  'src/components/svg-data-uri-color-literals.test.ts',
] as const;

/** The `bun test` flags the components package uses (browser+svelte conditions). */
const BUN_TEST_FLAGS = [
  '--conditions',
  'browser',
  '--conditions',
  'svelte',
  '--parallel=1',
] as const;

const FULL_SUITE_CHUNK_COUNT = 4;

const FULL_SUITE_NON_COMPONENT_PATHS = [
  'scripts',
  ...ALWAYS_RUN_PATHS,
  ...ALWAYS_RUN_ROOT_TESTS,
  ...FULL_SUITE_PRIVATE_COMPONENT_TESTS,
] as const;

function componentTestPath(slug: string): string {
  return `src/components/${slug}/`;
}

function assertExistingTestPaths(paths: string[], context: string): string[] {
  const missingPaths = paths.filter((path) => !existsSync(join(packageRoot, path)));
  if (missingPaths.length > 0) {
    throw new Error(
      `${context} references missing test path(s): ${missingPaths.toSorted().join(', ')}`,
    );
  }
  return paths;
}

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

  const paths: string[] = [...ALWAYS_RUN_PATHS, ...ALWAYS_RUN_ROOT_TESTS];
  for (const slug of decision.slugs) {
    paths.push(componentTestPath(slug));
  }
  return paths;
}

export function fullSuiteTestPathGroups(componentSlugs: string[]): string[][] {
  const groups = Array.from({ length: FULL_SUITE_CHUNK_COUNT }, () => [] as string[]);
  groups[0]!.push(...FULL_SUITE_NON_COMPONENT_PATHS);

  for (const [index, slug] of [...componentSlugs].toSorted().entries()) {
    groups[index % FULL_SUITE_CHUNK_COUNT]!.push(componentTestPath(slug));
  }

  return groups
    .map((group, index) => assertExistingTestPaths(group, `full-suite chunk ${index + 1}`))
    .filter((group) => group.length > 0);
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

async function main(): Promise<number> {
  installHookProcessCleanup();

  const baseRef = parseBaseRef(process.argv.slice(2));
  const decision = await resolveScope(baseRef);
  const paths = testPathsForScope(decision);

  if (paths === null) {
    const reason = decision.mode === 'full' ? decision.reason : 'no scoped slugs';
    process.stderr.write(`test-changed: full suite (${reason})\n`);
    const componentSlugs = [...(await loadKnownSlugs())];
    const groups = fullSuiteTestPathGroups(componentSlugs);

    for (const [index, group] of groups.entries()) {
      process.stderr.write(`test-changed: full suite chunk ${index + 1}/${groups.length}\n`);
      const result = await runHookCommand('bun', ['test', ...BUN_TEST_FLAGS, ...group], {
        cwd: packageRoot,
        environment: { TZ: 'UTC', LANG: 'en_US.UTF-8' },
        stderr: 'inherit',
        stdout: 'inherit',
      });
      if (result.exitCode !== 0) return result.exitCode;
    }
    return 0;
  } else {
    process.stderr.write(
      `test-changed: ${decision.mode === 'filtered' ? decision.slugs.length : 0} component(s): ` +
        `${decision.mode === 'filtered' ? decision.slugs.join(', ') : ''}\n`,
    );
  }

  const result = await runHookCommand('bun', ['test', ...BUN_TEST_FLAGS, ...paths], {
    cwd: packageRoot,
    environment: { TZ: 'UTC', LANG: 'en_US.UTF-8' },
    stderr: 'inherit',
    stdout: 'inherit',
  });
  return result.exitCode;
}

if (import.meta.main) {
  try {
    const exitCode = await withLocalValidationGateLock(main);
    process.exit(exitCode);
  } catch (caught) {
    error(`test-changed failed: ${String(caught)}`);
    process.exit(1);
  }
}
