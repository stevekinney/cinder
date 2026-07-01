import { describe, expect, it } from 'bun:test';

import {
  buildPublishedManifest,
  stripDanglingSourceMapUrlComments,
  type SourceManifest,
} from './pack-for-publish.ts';

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

  it('keeps dist .js.map files excluded from the published tarball', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('!dist/**/*.js.map');
  });

  it('rewrites source-backed runtime exports to built browser artifacts in the published manifest', () => {
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
        './button/schema': {
          types: './dist/components/button/button.schema.d.ts',
          browser: './src/components/button/button.schema.ts',
          node: './dist/server/components/button/button.schema.js',
          svelte: './src/components/button/button.schema.ts',
          default: './dist/components/button/button.schema.js',
        },
        './button/variables': {
          types: './dist/components/button/button.variables.d.ts',
          browser: './src/components/button/button.variables.ts',
          node: './dist/server/components/button/button.variables.js',
          svelte: './src/components/button/button.variables.ts',
          default: './dist/components/button/button.variables.js',
        },
        './styles/guard': {
          types: './dist/styles/base-guard.d.ts',
          browser: './src/styles/base-guard.ts',
          node: './dist/server/styles/base-guard.js',
          svelte: './src/styles/base-guard.ts',
          default: './dist/styles/base-guard.js',
        },
      },
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(published.exports['.']).toEqual({
      types: './dist/index.d.ts',
      browser: './dist/index.js',
      node: './dist/server/index.js',
      svelte: './dist/index.js',
      default: './dist/index.js',
    });
    expect(published.exports['./button']).toEqual({
      types: './dist/components/button/index.d.ts',
      browser: './dist/components/button/index.js',
      node: './dist/server/components/button/index.js',
      svelte: './dist/components/button/index.js',
      default: './dist/components/button/index.js',
    });
    expect(published.exports['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      browser: './dist/components/button/button.schema.js',
      node: './dist/server/components/button/button.schema.js',
      svelte: './dist/components/button/button.schema.js',
      default: './dist/components/button/button.schema.js',
    });
    expect(published.exports['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      browser: './dist/components/button/button.variables.js',
      node: './dist/server/components/button/button.variables.js',
      svelte: './dist/components/button/button.variables.js',
      default: './dist/components/button/button.variables.js',
    });
    expect(published.exports['./styles/guard']).toEqual({
      types: './dist/styles/base-guard.d.ts',
      browser: './dist/styles/base-guard.js',
      node: './dist/server/styles/base-guard.js',
      svelte: './dist/styles/base-guard.js',
      default: './dist/styles/base-guard.js',
    });
    expect(files).toContain('!src/components/**/*.schema.ts');
    expect(files).toContain('!src/components/**/*.variables.ts');
  });

  it('preserves component condition order so Node SSR wins over browser/svelte builds', () => {
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

  it('strips dangling sourceMappingURL comments when corresponding .map files are absent', () => {
    const input = 'export const value = 1;\n//# sourceMappingURL=index.js.map\n';
    const stripped = stripDanglingSourceMapUrlComments(input, () => false);
    expect(stripped.strippedCount).toBe(1);
    expect(stripped.text).toBe('export const value = 1;\n');
  });

  it('keeps sourceMappingURL comments when the corresponding .map file exists', () => {
    const input = 'export const value = 1;\n//# sourceMappingURL=index.js.map\n';
    const stripped = stripDanglingSourceMapUrlComments(input, () => true);
    expect(stripped.strippedCount).toBe(0);
    expect(stripped.text).toBe(input);
  });

  it('strips dangling block sourceMappingURL comments when corresponding .map files are absent', () => {
    const input = 'export const value = 1;\n/*# sourceMappingURL=index.js.map */\n';
    const stripped = stripDanglingSourceMapUrlComments(input, () => false);
    expect(stripped.strippedCount).toBe(1);
    expect(stripped.text).toBe('export const value = 1;\n');
  });

  it('strips missing editor source-map comments while preserving existing references', () => {
    const input =
      [
        'export const runtime = true;',
        '//# sourceMappingURL=component-runtime.js.map',
        '//# sourceMappingURL=attach.js.map',
        '//# sourceMappingURL=editor.js.map',
        '//# sourceMappingURL=types.js.map',
        '//# sourceMappingURL=keymap-plugin.js.map',
        '//# sourceMappingURL=commands.js.map',
      ].join('\n') + '\n';
    const stripped = stripDanglingSourceMapUrlComments(
      input,
      (reference) => reference === 'attach.js.map',
    );
    expect(stripped.strippedCount).toBe(5);
    expect(stripped.text).toContain('//# sourceMappingURL=attach.js.map');
    expect(stripped.text).not.toContain('component-runtime.js.map');
    expect(stripped.text).not.toContain('editor.js.map');
    expect(stripped.text).not.toContain('types.js.map');
    expect(stripped.text).not.toContain('keymap-plugin.js.map');
    expect(stripped.text).not.toContain('commands.js.map');
  });
});
