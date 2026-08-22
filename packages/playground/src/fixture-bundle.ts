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
  fixtureArtifactByPath,
  fixtureBuildPromiseByKey,
} from './build-artifacts-shared.ts';
import { PLAYGROUND_TEMP_ROOT, relativeImportSpecifier } from './playground-paths.ts';
import { getRebuildGeneration } from './rebuild-generation.ts';

/** Fixture-bundle entries: keyed by `fixtureEntryKey(...)` → entry artifact path. */
export const fixtureEntryByKey = new Map<string, string>();

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

    const result = await Bun.build({
      entrypoints: [entryTempPath],
      publicPath: PUBLIC_PATH_BY_FAMILY.fixture,
      ...SHARED_BUILD_OPTIONS,
    });

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
  }
}

export async function buildFixtureBundle(
  componentName: string,
  fixture: VisualFixture,
  fixtureContentHash: string,
  componentOrHostPath: string,
): Promise<string | null> {
  const entryKey = fixtureEntryKey(componentName, fixture.name, fixtureContentHash);
  const cachedEntryPath = fixtureEntryByKey.get(entryKey);
  if (cachedEntryPath) {
    const cached = fixtureArtifactByPath.get(cachedEntryPath);
    if (cached !== undefined) return cachedEntryPath;
  }

  const cacheKey = fixtureCacheKey(componentName, fixture, fixtureContentHash);
  const existing = fixtureBuildPromiseByKey.get(cacheKey);
  if (existing !== undefined) return existing;

  const buildPromise = (async () => {
    const generationAtStart = getRebuildGeneration();
    const entry = await compileFixtureBundleArtifacts(
      componentName,
      fixture,
      fixtureContentHash,
      componentOrHostPath,
    );
    if (entry === null) return null;

    // Always publish the artifacts (matches buildPageBundle's rationale —
    // chunk filenames are content-hashed, so publishing is safe regardless
    // of a racing invalidation) and always return the entry path to the
    // caller that requested this compile: it genuinely succeeded, and the
    // route that serves `/fixture-bundle/:filename.js` resolves by the
    // SPECIFIC hashed path this response embeds, not through
    // `fixtureEntryByKey` — so the fixture page still renders correctly
    // even when the cache pointer below isn't updated.
    for (const [path, code] of entry.artifacts) fixtureArtifactByPath.set(path, code);
    // Only update the "latest" entry-key pointer when we're not racing a
    // newer invalidation, so a FUTURE lookup by `entryKey` doesn't resolve
    // to this now-superseded build.
    if (generationAtStart === getRebuildGeneration()) {
      fixtureEntryByKey.set(entryKey, entry.entryPath);
    }
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
