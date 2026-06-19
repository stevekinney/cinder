import { describe, expect, it } from 'bun:test';

import { buildPublishedManifest, type SourceManifest } from './pack-for-publish.ts';

describe('buildPublishedManifest', () => {
  it('keeps Svelte test-harness exclusions after broad Svelte includes', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files.indexOf('src/components/**/*.svelte')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('!src/components/**/*fixture*.svelte')).toBeGreaterThan(
      files.indexOf('src/components/**/*.svelte'),
    );
    expect(files.indexOf('!src/components/**/_*-test-harness.svelte')).toBeGreaterThan(
      files.indexOf('src/components/**/*.svelte'),
    );
    expect(files.indexOf('!src/components/**/*.type-test.svelte')).toBeGreaterThan(
      files.indexOf('src/components/**/*.svelte'),
    );
  });

  it('includes src/styles/**/*.css.d.ts so reserved styles type stubs are published', () => {
    // Regression guard: the `types` condition on every `./styles*` export
    // points at `./src/styles/<name>.css.d.ts`. Without this glob those files
    // are absent from the tarball and consumers see
    // "Cannot find module or type declarations for side-effect import" under
    // moduleResolution: bundler.
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/styles/**/*.css.d.ts');
  });

  it('includes src/styles/base-guard.ts so the `./styles/guard` svelte source ships', () => {
    // Regression guard: the `./styles/guard` export's `svelte` condition points
    // at `./src/styles/base-guard.ts`. The build emits only
    // `dist/styles/base-guard.js`, so without this entry a Svelte-aware consumer
    // resolving the source condition hits a dangling path. It is the only `.ts`
    // under `src/styles/` that ships, so it is listed explicitly rather than via
    // a `src/styles/**/*.ts` glob.
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/styles/base-guard.ts');
  });

  it('publishes only exported component JSON sidecars', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/components/**/*.examples.json');
    expect(files).toContain('src/components/**/*.constraints.json');
    expect(files).not.toContain('src/components/**/*.json');
  });
});
