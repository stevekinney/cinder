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

  it('publishes schema and variables subpaths through built artifacts only', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {
        './button': {
          types: './dist/components/button/index.d.ts',
          browser: './src/components/button/index.ts',
          node: './dist/server/components/button/index.js',
          svelte: './src/components/button/index.ts',
          default: './dist/components/button/index.js',
        },
        './button/schema': {
          types: './dist/components/button/button.schema.d.ts',
          node: './dist/server/components/button/button.schema.js',
          svelte: './src/components/button/button.schema.ts',
          default: './dist/components/button/button.schema.js',
        },
        './button/variables': {
          types: './dist/components/button/button.variables.d.ts',
          node: './dist/server/components/button/button.variables.js',
          svelte: './src/components/button/button.variables.ts',
          default: './dist/components/button/button.variables.js',
        },
      },
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(published.exports['./button']).toEqual(manifest.exports['./button']);
    expect(published.exports['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      node: './dist/server/components/button/button.schema.js',
      default: './dist/components/button/button.schema.js',
    });
    expect(published.exports['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      node: './dist/server/components/button/button.variables.js',
      default: './dist/components/button/button.variables.js',
    });
    expect(files).toContain('!src/components/**/*.schema.ts');
    expect(files).toContain('!src/components/**/*.variables.ts');
  });

  it('preserves component condition order so Node SSR wins over Svelte source', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          browser: './src/index.ts',
          node: './dist/server/index.js',
          svelte: './src/index.ts',
          default: './dist/index.js',
        },
        './button': {
          types: './dist/components/button/index.d.ts',
          browser: './src/components/button/index.ts',
          node: './dist/server/components/button/index.js',
          svelte: './src/components/button/index.ts',
          default: './dist/components/button/index.js',
        },
      },
    };

    const published = buildPublishedManifest(manifest, []);

    expect(Object.keys(published.exports['.']!)).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'default',
    ]);
    expect(Object.keys(published.exports['./button']!)).toEqual([
      'types',
      'browser',
      'node',
      'svelte',
      'default',
    ]);
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
