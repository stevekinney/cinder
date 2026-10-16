import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

/**
 * Regression guard for an earlier issue #756 occurrence
 * (`hydration_mismatch` on Chat's first SSR load, root-caused to
 * `@lostgradient/cinder`).
 *
 * Lucide used to be a loosely ranged `peerDependency` (`>=0.400.0 <1`).
 * Cinder's prebuilt SSR bundle (`dist/server`, resolved via the `node` export
 * condition) bakes in whichever Lucide version was installed in Cinder's own
 * build at publish time. A consuming application's client bundle resolves
 * Lucide fresh, at whatever version its own package manager picked within that
 * peer range. Whenever those two versions differ AND Lucide redrew an icon's
 * artwork between them, the server-rendered markup and the client's hydrated
 * markup diverge structurally — a real `[svelte] hydration_mismatch`.
 *
 * The fix made Lucide a regular `dependency` of Cinder rather than a peer.
 * Cinder now uses `@lucide/svelte`, which replaced the deprecated
 * `lucide-svelte` package, so this test pins that the replacement keeps the
 * regular-dependency contract and that the deprecated package is gone from
 * the manifest entirely rather than left installed beside it.
 */

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, unknown>;
};

async function readCinderManifest(): Promise<PackageManifest> {
  const manifestPath = join(import.meta.dir, '..', 'package.json');
  return JSON.parse(await Bun.file(manifestPath).text()) as PackageManifest;
}

describe('@lostgradient/cinder Lucide dependency contract', () => {
  it('declares @lucide/svelte as a regular dependency', async () => {
    const manifest = await readCinderManifest();

    expect(manifest.dependencies?.['@lucide/svelte']).toBeDefined();
  });

  it('does not declare @lucide/svelte as a peer dependency', async () => {
    const manifest = await readCinderManifest();

    expect(manifest.peerDependencies?.['@lucide/svelte']).toBeUndefined();
    expect(manifest.peerDependenciesMeta?.['@lucide/svelte']).toBeUndefined();
  });

  it('no longer declares the deprecated lucide-svelte package anywhere', async () => {
    const manifest = await readCinderManifest();

    for (const block of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
      manifest.peerDependenciesMeta,
    ]) {
      expect(block?.['lucide-svelte']).toBeUndefined();
    }
  });
});
