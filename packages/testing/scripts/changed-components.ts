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
 *   - source below a configured extracted component package — retests that
 *     package's complete component family, whose internal graph is cohesive.
 * Everything the graph cannot place falls through to `computeScope`, which
 * force-fulls on anything it cannot map.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeScope,
  loadSourceFiles,
  type ScopeDecision,
} from '../../components/scripts/component-graph.ts';
// Canonical compose-only list lives with the playground discovery logic. It is
// import-light (only `node:path`), so pulling the constant here does not drag in
// any playground runtime. Threaded into computeScope so the scope job's emitted
// slugs match the Playwright runner's manifest vocabulary (compose-only leaves
// like `feed-event` have no standalone page and must not be emitted).
import {
  CINDER_COMPONENT_SOURCE,
  COMPONENT_SOURCES,
  type ComponentSource,
} from '../../playground/src/component-sources.ts';
import { COMPOSE_ONLY_COMPONENTS, discoverComponents } from '../../playground/src/discover.ts';
import { parseComponentFilter } from '../src/helpers/component-filter.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
// scripts/ → packages/testing → packages → repo root
const workspaceRoot = resolve(scriptDirectory, '..', '..', '..');

/** `packages/playground/src/examples/<slug>/…` → `<slug>`. */
const examplePattern = /^packages\/playground\/src\/examples\/([a-z0-9][a-z0-9-]*)\//;
const extractedComponentSources = COMPONENT_SOURCES.filter(
  (source) => source.id !== CINDER_COMPONENT_SOURCE.id && source.componentNames !== null,
);

function extractedComponentSourceMatch(
  path: string,
): { componentName: string; source: ComponentSource } | null {
  for (const source of extractedComponentSources) {
    const prefix = `${source.repositoryComponentsRoot}/`;
    if (!path.startsWith(prefix)) continue;
    const componentName = path.slice(prefix.length).split('/')[0];
    if (componentName !== undefined && componentName.length > 0) {
      return { componentName, source };
    }
  }
  return null;
}

export type Decision =
  | { mode: 'full'; reason: string }
  | { mode: 'filtered'; components: string[] };

/**
 * Normalize an explicit component scope from `workflow_dispatch` inputs.
 * Empty input means "full matrix"; non-empty input must name a standalone slug.
 *
 * `knownSlugs` is the filesystem superset and includes compose-only leaves
 * (e.g. `feed-event`) that have no standalone Playwright page. Dispatching one
 * of those would pass shape validation here but be rejected later by the runner
 * manifest as an unknown slug — a confusing late failure. Subtracting the
 * compose-only set up front makes `parseComponentFilter` throw in the scope job
 * instead, listing only the slugs the runner can actually test.
 */
export function decideExplicitComponents(
  rawComponents: string | undefined,
  knownSlugs: ReadonlySet<string>,
  composeOnlySlugs: ReadonlySet<string> = COMPOSE_ONLY_COMPONENTS,
): Decision {
  const standaloneSlugs = new Set([...knownSlugs].filter((slug) => !composeOnlySlugs.has(slug)));
  const parsed = parseComponentFilter(rawComponents, standaloneSlugs);
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
  const deletedFileSet = new Set(deletedFiles);

  // Example changes map directly to a slug. Collect them, and hand the rest to
  // the graph. An example for an UNKNOWN slug forces full (mirrors the graph's
  // unknown-slug guard) rather than silently inventing a slug.
  const exampleSlugs = new Set<string>();
  const extractedPackageSlugs = new Set<string>();
  const nonExampleChanges: string[] = [];
  for (const path of cleaned) {
    const exampleMatch = examplePattern.exec(path);
    const extractedSourceMatch = extractedComponentSourceMatch(path);
    if (exampleMatch?.[1] !== undefined) {
      if (!knownSlugs.has(exampleMatch[1])) {
        return { mode: 'full', reason: `example for unknown slug: ${path}` };
      }
      exampleSlugs.add(exampleMatch[1]);
    } else if (extractedSourceMatch !== null) {
      if (!knownSlugs.has(extractedSourceMatch.componentName)) {
        return { mode: 'full', reason: `source for unknown extracted slug: ${path}` };
      }
      if (deletedFileSet.has(path)) {
        return { mode: 'full', reason: `deleted extracted-package source: ${path}` };
      }
      for (const componentName of extractedSourceMatch.source.componentNames ?? []) {
        if (knownSlugs.has(componentName)) extractedPackageSlugs.add(componentName);
      }
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
    if (
      (exampleSlugs.size > 0 || extractedPackageSlugs.size > 0) &&
      graphDecision.reason === 'no component-mapped changes detected'
    ) {
      return {
        mode: 'filtered',
        components: [...exampleSlugs, ...extractedPackageSlugs].toSorted(),
      };
    }
    return { mode: 'full', reason: graphDecision.reason };
  }

  const components = new Set<string>([
    ...graphDecision.slugs,
    ...exampleSlugs,
    ...extractedPackageSlugs,
  ]);
  const cinderSourceChanged = nonExampleChanges.some((path) =>
    path.startsWith('packages/components/src/'),
  );
  if (cinderSourceChanged) {
    for (const source of extractedComponentSources) {
      for (const componentName of source.componentNames ?? []) {
        if (knownSlugs.has(componentName)) components.add(componentName);
      }
    }
  }
  return { mode: 'filtered', components: [...components].toSorted() };
}

// Every extracted package's known component names, flattened into one set.
// `decide()` only ever emits a slug here once it is a KNOWN slug (the graph
// force-fulls on anything unknown), so subtracting this set from a filtered
// `components` list is safe: what's left is exactly the slugs `@lostgradient/cinder`'s
// own `loadKnownSlugs()` (packages/components/src/components/**) can resolve.
const extractedSlugs = new Set(
  extractedComponentSources.flatMap((source) => source.componentNames ?? []),
);

/**
 * Narrow a filtered scope's combined slug list (which spans every package
 * `changed-components.ts` knows about — cinder plus each extracted package) down
 * to the slugs `@lostgradient/cinder`'s own `test:changed` can resolve.
 *
 * `browser-tests.yaml` keeps using the combined `components` output as-is: its
 * Playwright manifest already spans every package. `unit-tests.yaml` scopes
 * `@lostgradient/cinder`'s unit suite specifically, so it needs this narrower
 * set — passing it an extracted package's slug (e.g. `chat`) would fail loud
 * (by design), not silently skip, so this filter must not be skipped either.
 */
export function cinderOnlyComponents(components: readonly string[]): string[] {
  return components.filter((slug) => !extractedSlugs.has(slug));
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
  // `unit-tests.yaml` scopes @lostgradient/cinder specifically (unlike
  // browser-tests.yaml's combined Playwright manifest), so it gets its own
  // narrowed output rather than reusing `components` for a different package.
  const cinderComponentsValue =
    decision.mode === 'filtered' ? cinderOnlyComponents(decision.components).join(',') : '';
  const payload = [
    `mode=${decision.mode}`,
    `component_scope_mode=${decision.mode}`,
    `components=${componentsValue}`,
    `cinder_components=${cinderComponentsValue}`,
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
  const knownSlugs = new Set(await discoverComponents());

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
