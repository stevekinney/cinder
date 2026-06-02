/**
 * Decide which component test scope a diff requires: the full matrix, or a
 * filtered slug list covering the changed components AND every component that
 * (transitively) depends on them.
 *
 * Reads newline-separated changed file paths from stdin (the output of
 * `git diff --name-only <base>..HEAD`) and either appends `mode=`,
 * `component_scope_mode=`, and `components=` to `$GITHUB_OUTPUT` (CI) or prints
 * them to stdout (local debugging).
 *
 * The real dependency logic lives in
 * `packages/components/scripts/component-graph.ts` — a pure, file-level import
 * graph. This script is the thin CLI adapter: it loads the source files and
 * known slugs, classifies the diff, and emits the decision in the format the
 * `browser-tests.yaml` `scope` job expects.
 *
 * Scope is `full` whenever anything is uncertain (a shared/harness/config
 * change, a deletion, a computed dynamic import, an ambiguous resolution, or a
 * closure that reaches an unknown slug) — a missed edge silently skips a test,
 * which is strictly worse than a redundant full run. It is `filtered` only when
 * every changed file maps cleanly to a known component slug or its dependents.
 *
 * Beyond component source, two diff categories also map to slugs directly:
 *   - `packages/playground/src/examples/<slug>/…` — a component's playground
 *     example feeds its rendered fixture, so an example change retests `<slug>`.
 * Everything the graph cannot place falls through to `computeScope`, which
 * force-fulls on anything it cannot map.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeScope,
  loadKnownSlugs,
  loadSourceFiles,
  type ScopeDecision,
} from '../../components/scripts/component-graph.ts';
// Canonical compose-only list lives with the playground discovery logic. It is
// import-light (only `node:path`), so pulling the constant here does not drag in
// any playground runtime. Threaded into computeScope so the scope job's emitted
// slugs match the Playwright runner's manifest vocabulary (compose-only leaves
// like `feed-event` have no standalone page and must not be emitted).
import { COMPOSE_ONLY_COMPONENTS } from '../../playground/src/discover.ts';
import { parseComponentFilter } from '../src/helpers/component-filter.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
// scripts/ → packages/testing → packages → repo root
const workspaceRoot = resolve(scriptDirectory, '..', '..', '..');

/** `packages/playground/src/examples/<slug>/…` → `<slug>`. */
const examplePattern = /^packages\/playground\/src\/examples\/([a-z0-9][a-z0-9-]*)\//;

export type Decision =
  | { mode: 'full'; reason: string }
  | { mode: 'filtered'; components: string[] };

/**
 * Normalize an explicit component scope from `workflow_dispatch` inputs.
 * Empty input means "full matrix"; non-empty input must name known slugs.
 */
export function decideExplicitComponents(
  rawComponents: string | undefined,
  knownSlugs: ReadonlySet<string>,
): Decision {
  const parsed = parseComponentFilter(rawComponents, knownSlugs);
  if (parsed === null) {
    return { mode: 'full', reason: 'explicit component scope empty' };
  }
  return { mode: 'filtered', components: [...parsed].toSorted() };
}

/**
 * Decide scope from a list of changed file paths.
 *
 * Pure-ish: the source-file map and known-slug set are injected so unit tests
 * exercise the classification without the filesystem. `deletedFiles` lists the
 * changed paths that no longer exist on disk (deletions/renames) — those force
 * full because the current-state graph cannot know who depended on them.
 *
 * @param changedFiles - newline-stripped paths from `git diff --name-only`.
 * @param sourceFiles - the scanned source set (repo-relative POSIX path → text).
 * @param knownSlugs - component slugs derived from the source tree.
 * @param deletedFiles - changed paths absent on disk.
 */
export function decide(
  changedFiles: string[],
  sourceFiles: ReadonlyMap<string, string>,
  knownSlugs: ReadonlySet<string>,
  deletedFiles: string[] = [],
  composeOnlySlugs: ReadonlySet<string> = COMPOSE_ONLY_COMPONENTS,
): Decision {
  const cleaned = changedFiles.map((line) => line.trim()).filter((line) => line.length > 0);

  // Example changes map directly to a slug. Collect them, and hand the rest to
  // the graph. An example for an UNKNOWN slug forces full (mirrors the graph's
  // unknown-slug guard) rather than silently inventing a slug.
  const exampleSlugs = new Set<string>();
  const nonExampleChanges: string[] = [];
  for (const path of cleaned) {
    const match = examplePattern.exec(path);
    if (match?.[1] !== undefined) {
      if (!knownSlugs.has(match[1])) {
        return { mode: 'full', reason: `example for unknown slug: ${path}` };
      }
      exampleSlugs.add(match[1]);
    } else {
      nonExampleChanges.push(path);
    }
  }

  const graphDecision: ScopeDecision = computeScope({
    changedFiles: nonExampleChanges,
    deletedFiles,
    sourceFiles,
    knownSlugs,
    composeOnlySlugs,
  });

  if (graphDecision.mode === 'full') {
    // If the ONLY changes were examples (the graph saw nothing to map and said
    // "no component-mapped changes"), the example slugs are still a valid
    // filtered scope. Any other full reason (real force-full trigger) wins.
    if (exampleSlugs.size > 0 && graphDecision.reason === 'no component-mapped changes detected') {
      return { mode: 'filtered', components: [...exampleSlugs].toSorted() };
    }
    return { mode: 'full', reason: graphDecision.reason };
  }

  const components = new Set<string>([...graphDecision.slugs, ...exampleSlugs]);
  return { mode: 'filtered', components: [...components].toSorted() };
}

/**
 * Partition the raw changed-file list into (all, deleted). A path is "deleted"
 * when it does not exist on disk at HEAD — the working tree CI checked out.
 */
function partitionDeleted(changedFiles: string[]): { all: string[]; deleted: string[] } {
  const all: string[] = [];
  const deleted: string[] = [];
  for (const raw of changedFiles) {
    const path = raw.trim();
    if (path.length === 0) continue;
    all.push(path);
    if (!existsSync(join(workspaceRoot, path))) deleted.push(path);
  }
  return { all, deleted };
}

async function emit(decision: Decision): Promise<void> {
  const githubOutput = process.env['GITHUB_OUTPUT'];
  const componentsValue = decision.mode === 'filtered' ? decision.components.join(',') : '';
  const payload = [
    `mode=${decision.mode}`,
    `component_scope_mode=${decision.mode}`,
    `components=${componentsValue}`,
    '',
  ].join('\n');

  if (githubOutput !== undefined && githubOutput.length > 0) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(githubOutput, payload, 'utf-8');
  } else {
    process.stdout.write(payload);
  }

  if (decision.mode === 'full') {
    process.stderr.write(`changed-components: full — ${decision.reason}\n`);
  } else {
    process.stderr.write(
      `changed-components: ${decision.components.length} component(s): ${decision.components.join(', ')}\n`,
    );
  }
}

async function main(): Promise<void> {
  const explicitComponents = process.env['CINDER_TEST_COMPONENTS'];
  const knownSlugs = await loadKnownSlugs();

  let decision: Decision;
  if (explicitComponents !== undefined) {
    decision = decideExplicitComponents(explicitComponents, knownSlugs);
  } else {
    const input = await Bun.stdin.text();
    const { all, deleted } = partitionDeleted(input.split('\n'));
    const sourceFiles = await loadSourceFiles();
    // composeOnlySlugs defaults to COMPOSE_ONLY_COMPONENTS (decide()'s default),
    // so the real CI run threads the canonical compose-only set; the discover.ts
    // drift-guard test keeps that set in sync with the filesystem.
    decision = decide(all, sourceFiles, knownSlugs, deleted);
  }

  await emit(decision);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`changed-components failed: ${String(error)}\n`);
    process.exit(1);
  });
}
