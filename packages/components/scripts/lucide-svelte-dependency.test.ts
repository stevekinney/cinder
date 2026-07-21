import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

/**
 * Regression guard for issue #756 (`hydration_mismatch` on Chat's first SSR
 * load, root-caused to `@lostgradient/cinder`).
 *
 * `lucide-svelte` used to be a loosely ranged `peerDependency`
 * (`>=0.400.0 <1`). Cinder's prebuilt SSR bundle (`dist/server`, resolved via
 * the `node` export condition) bakes in whichever `lucide-svelte` version was
 * installed in Cinder's own build at publish time. A consuming application's
 * client bundle resolves `lucide-svelte` fresh, at whatever version its own
 * package manager picked within that peer range. Confirmed against a real
 * SvelteKit dev server, a real browser, and the real published npm packages
 * (`@lostgradient/chat@0.1.1` + `@lostgradient/cinder@0.16.1`): whenever those
 * two versions differ AND Lucide happened to redraw an icon's artwork between
 * them (different `<path>` count/coordinates for the same icon name), the
 * server-rendered markup and the client's hydrated markup diverge
 * structurally — a real `[svelte] hydration_mismatch`.
 *
 * The fix: `lucide-svelte` is now a pinned, exact-version regular
 * `dependency` of Cinder rather than a peer, so the same version renders
 * identical icon markup on both sides regardless of what a consuming
 * application installs for its own icons. This test pins that contract at the
 * manifest level — fast and deterministic, unlike a full packed-tarball +
 * real-browser hydration round trip (which this bug required to prove in the
 * first place; see `packages/components/scripts/validate-consumers.ts`'s
 * `sveltekit-consumer` `/chat-layout` route, which now pins a deliberately
 * different `lucide-svelte` version in that fixture to keep exercising this
 * exact skew end-to-end).
 */

const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

type PackageManifest = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, unknown>;
};

async function readCinderManifest(): Promise<PackageManifest> {
  const manifestPath = join(import.meta.dir, '..', 'package.json');
  return JSON.parse(await Bun.file(manifestPath).text()) as PackageManifest;
}

describe('@lostgradient/cinder lucide-svelte dependency contract', () => {
  it('pins lucide-svelte to an exact version as a regular dependency', async () => {
    const manifest = await readCinderManifest();
    const pinnedVersion = manifest.dependencies?.['lucide-svelte'];

    expect(pinnedVersion).toBeDefined();
    expect(pinnedVersion).toMatch(EXACT_VERSION_PATTERN);
  });

  it('does not declare lucide-svelte as a peer dependency', async () => {
    const manifest = await readCinderManifest();

    expect(manifest.peerDependencies?.['lucide-svelte']).toBeUndefined();
    expect(manifest.peerDependenciesMeta?.['lucide-svelte']).toBeUndefined();
  });
});
