import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  fixtureRenderMode,
  type VisualFixture,
} from '../../components/scripts/lib/visual-fixtures/schema.ts';
import {
  PUBLIC_PATH_BY_FAMILY,
  SHARED_BUILD_OPTIONS,
  collectBuildArtifacts,
  coordinatedBuild,
  createSettledBuildCollector,
  fixtureArtifactByPath,
  fixtureBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { PLAYGROUND_TEMP_ROOT, relativeImportSpecifier } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

const startFixtureBuildMemoryCycle = createSettledBuildCollector(24);

/** Fixture-bundle entries: keyed by `fixtureEntryKey(...)` → entry artifact path. */
export const fixtureEntryByKey = new Map<string, string>();
const fixtureArtifactPathsByEntryKey = new Map<string, ReadonlySet<string>>();
/** Assets returned in fixture HTML remain pinned until their entry is fetched. */
const pendingFixtureResponseCounts = new Map<string, number>();
/** 32 covers the local fullyParallel browser workload plus concurrent asset fetches. */
const MAX_FIXTURE_RESPONSE_LEASES = 32;
/** Bounded safety net for assets returned just before cache eviction. */
const evictedFixtureArtifactsByEntryKey = new Map<string, Map<string, string>>();
const MAX_CACHED_FIXTURE_ENTRIES = 8;

export function clearFixtureBundleCaches(): void {
  fixtureEntryByKey.clear();
  fixtureArtifactByPath.clear();
  fixtureArtifactPathsByEntryKey.clear();
  pendingFixtureResponseCounts.clear();
  evictedFixtureArtifactsByEntryKey.clear();
}

/** Resolve a fixture asset from the live cache or bounded post-eviction cache. */
export function findFixtureArtifact(path: string): string | undefined {
  const live = fixtureArtifactByPath.get(path);
  if (live !== undefined) {
    for (const [entryKey, entryPath] of fixtureEntryByKey) {
      if (entryPath !== path) continue;
      const responseLeases = pendingFixtureResponseCounts.get(entryKey) ?? 0;
      if (responseLeases <= 1) pendingFixtureResponseCounts.delete(entryKey);
      else pendingFixtureResponseCounts.set(entryKey, responseLeases - 1);
    }
    return live;
  }
  return [...evictedFixtureArtifactsByEntryKey.values()]
    .map((artifacts) => artifacts.get(path))
    .find((code): code is string => code !== undefined);
}

/** Reserve an entry for an HTML response until its first browser fetch. */
export function retainFixtureEntry(entryKey: string): boolean {
  if (!fixtureArtifactPathsByEntryKey.has(entryKey) || !fixtureEntryByKey.has(entryKey))
    return false;
  const retainedResponseCount = [...pendingFixtureResponseCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  if (retainedResponseCount >= MAX_FIXTURE_RESPONSE_LEASES) return false;
  pendingFixtureResponseCounts.set(entryKey, (pendingFixtureResponseCounts.get(entryKey) ?? 0) + 1);
  return true;
}

export function publishFixtureArtifacts(
  entryKey: string,
  artifacts: ReadonlyMap<string, string>,
  maximumEntries = MAX_CACHED_FIXTURE_ENTRIES,
  reserveResponseLease = false,
): boolean {
  if (
    reserveResponseLease &&
    [...pendingFixtureResponseCounts.values()].reduce((total, count) => total + count, 0) >=
      MAX_FIXTURE_RESPONSE_LEASES
  ) {
    return false;
  }
  if (
    !fixtureArtifactPathsByEntryKey.has(entryKey) &&
    fixtureArtifactPathsByEntryKey.size >= maximumEntries &&
    [...fixtureArtifactPathsByEntryKey.keys()].every((key) => pendingFixtureResponseCounts.has(key))
  ) {
    return false;
  }
  if (reserveResponseLease)
    pendingFixtureResponseCounts.set(
      entryKey,
      (pendingFixtureResponseCounts.get(entryKey) ?? 0) + 1,
    );
  fixtureArtifactPathsByEntryKey.delete(entryKey);
  fixtureArtifactPathsByEntryKey.set(entryKey, new Set(artifacts.keys()));
  evictedFixtureArtifactsByEntryKey.delete(entryKey);
  for (const [path, code] of artifacts) fixtureArtifactByPath.set(path, code);

  while (fixtureArtifactPathsByEntryKey.size > maximumEntries) {
    const oldestEntryKey = [...fixtureArtifactPathsByEntryKey.keys()].find(
      (key) => !pendingFixtureResponseCounts.has(key),
    );
    if (oldestEntryKey === undefined) return false;
    const evictedPaths = fixtureArtifactPathsByEntryKey.get(oldestEntryKey);
    fixtureArtifactPathsByEntryKey.delete(oldestEntryKey);
    fixtureEntryByKey.delete(oldestEntryKey);
    pendingFixtureResponseCounts.delete(oldestEntryKey);
    if (evictedPaths === undefined) continue;
    const evictedArtifacts = new Map<string, string>();
    const retainedPaths = new Set(
      [...fixtureArtifactPathsByEntryKey.values()].flatMap((paths) => [...paths]),
    );
    for (const path of evictedPaths) {
      if (!retainedPaths.has(path)) {
        const code = fixtureArtifactByPath.get(path);
        if (code !== undefined) evictedArtifacts.set(path, code);
        fixtureArtifactByPath.delete(path);
      }
    }
    if (evictedArtifacts.size > 0) {
      evictedFixtureArtifactsByEntryKey.set(oldestEntryKey, evictedArtifacts);
    }
    while (evictedFixtureArtifactsByEntryKey.size > MAX_CACHED_FIXTURE_ENTRIES) {
      const oldestFallback = evictedFixtureArtifactsByEntryKey.keys().next().value;
      if (oldestFallback === undefined) break;
      evictedFixtureArtifactsByEntryKey.delete(oldestFallback);
    }
  }
  return true;
}

export function fixtureEntryKey(
  componentName: string,
  fixtureName: string,
  fixtureContentHash: string,
): string {
  return `fixture-${componentName}-${fixtureName}-${fixtureContentHash}`;
}

export function fixtureCacheKey(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
): string {
  return `${componentName}/${fixture.name}/${fixtureRenderMode(fixture)}/${fixtureContentHash}`;
}

export async function compileFixtureBundleArtifacts(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
  componentOrHostPath: string,
): Promise<{ entryPath: string; entryCode: string; artifacts: Map<string, string> } | null> {
  const settleBuildMemoryCycle = startFixtureBuildMemoryCycle();
  const entryBasename = fixtureEntryKey(componentName, fixture.name, fixtureContentHash);
  const entryTempDir = join(PLAYGROUND_TEMP_ROOT, randomUUID());
  const entryTempPath = join(entryTempDir, `${entryBasename}.ts`);
  const propsTempPath = join(entryTempDir, `${entryBasename}-props.ts`);
  const componentImport = relativeImportSpecifier(entryTempDir, componentOrHostPath);
  const fixtureProps = 'props' in fixture && fixture.props !== undefined ? fixture.props : {};

  const entrySource = `import { flushSync, mount } from 'svelte';

import Component from ${JSON.stringify(componentImport)};
import props from './${entryBasename}-props.ts';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('[cinder playground] #app target not found');
}

mount(Component, { target, props });
flushSync();
`;

  try {
    await Bun.write(entryTempPath, entrySource);
    await Bun.write(
      propsTempPath,
      `const props = ${JSON.stringify(fixtureProps)} as const;\nexport default props;\n`,
    );

    const result = await coordinatedBuild(() =>
      Bun.build({
        entrypoints: [entryTempPath],
        publicPath: PUBLIC_PATH_BY_FAMILY.fixture,
        ...SHARED_BUILD_OPTIONS,
      }),
    );

    if (!result.success) {
      console.error(
        `[playground] fixture bundle failed for ${componentName}/${fixture.name}:`,
        result.logs,
      );
      return null;
    }

    const entry = await collectBuildArtifacts(result.outputs);
    if (entry === null) {
      console.error(
        `[playground] fixture bundle for ${componentName}/${fixture.name} produced no entry chunk`,
      );
      return null;
    }

    return entry;
  } finally {
    rmSync(entryTempDir, { recursive: true, force: true });
    settleBuildMemoryCycle();
  }
}

export async function buildFixtureBundle(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
  componentOrHostPath: string,
  onGenerationCaptured?: () => void,
): Promise<string | null> {
  const entryKey = fixtureEntryKey(componentName, fixture.name, fixtureContentHash);
  const cachedEntryPath = fixtureEntryByKey.get(entryKey);
  if (cachedEntryPath) {
    const cached = fixtureArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) {
      return retainFixtureEntry(entryKey) ? cachedEntryPath : null;
    }
  }

  const cacheKey = fixtureCacheKey(componentName, fixture, fixtureContentHash);
  const existing = fixtureBuildPromiseByKey.get(cacheKey);
  if (existing !== undefined) {
    const entryPath = await existing;
    if (entryPath === null) return null;
    return retainFixtureEntry(entryKey) ? entryPath : null;
  }

  const buildPromise = (async () => {
    const generationAtStart = getRebuildGeneration();
    onGenerationCaptured?.();
    const entry = await compileFixtureBundleArtifacts(
      componentName,
      fixture,
      fixtureContentHash,
      componentOrHostPath,
    );
    if (entry === null) return null;

    if (generationAtStart !== getRebuildGeneration()) return null;

    // Publish only a current-generation result. A stale result must not alter
    // same-key artifact bookkeeping or return an entry path after invalidation.
    if (!publishFixtureArtifacts(entryKey, entry.artifacts, MAX_CACHED_FIXTURE_ENTRIES, true)) {
      return null;
    }
    // Only update the "latest" entry-key pointer when we're not racing a
    // newer invalidation, so a FUTURE lookup by `entryKey` doesn't resolve
    // to this now-superseded build.
    fixtureEntryByKey.set(entryKey, entry.entryPath);
    return entry.entryPath;
  })();

  fixtureBuildPromiseByKey.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    // Only remove OUR OWN entry — see buildPageBundle's identical guard for
    // why an unconditional delete would risk clobbering a newer build.
    if (fixtureBuildPromiseByKey.get(cacheKey) === buildPromise) {
      fixtureBuildPromiseByKey.delete(cacheKey);
    }
  }
}
