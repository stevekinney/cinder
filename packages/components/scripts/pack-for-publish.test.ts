import { describe, expect, it } from 'bun:test';

import {
  buildPublishedManifest,
  stripDanglingSourceMapUrlComments,
  transpileSvelteComponentScriptsForPublish,
  transpileSvelteTypeScriptModuleForPublish,
  type SourceManifest,
} from './pack-for-publish.ts';

describe('buildPublishedManifest', () => {
  it('publishes source component Svelte and TypeScript runtime files for Svelte-aware consumers', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/components/**/*.ts');
    expect(files).toContain('src/components/**/*.svelte');
    expect(files).toContain('!src/components/**/*.test.ts');
    expect(files).toContain('!src/components/**/*.spec.ts');
    expect(files).toContain('!src/components/**/*.type-test.svelte');
    expect(files).toContain('!src/components/**/*.fixture.ts');
    expect(files).toContain('!src/components/**/*-fixture.ts');
    expect(files).toContain('!src/components/**/*fixture*.svelte');
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

  it('includes source component CSS partials used by styles/all', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/components/**/*.css');
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

  it('preserves the cinder binary declaration and includes dist in the tarball', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      bin: {
        cinder: './dist/cli/index.js',
      },
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);

    expect(published.bin).toEqual({ cinder: './dist/cli/index.js' });
    expect(published.files).toContain('dist');
  });

  it('removes sourceMappingURL references when the publish policy excludes maps', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const excludesDistributionSourceMaps = (published.files ?? []).includes('!dist/**/*.js.map');
    const input = 'export const value = 1;\n//# sourceMappingURL=index.js.map\n';

    const stripped = stripDanglingSourceMapUrlComments(
      input,
      () => !excludesDistributionSourceMaps,
    );

    expect(excludesDistributionSourceMaps).toBe(true);
    expect(stripped.strippedCount).toBe(1);
    expect(stripped.text).toBe('export const value = 1;\n');
  });

  it('preserves source-backed runtime exports in the published manifest', () => {
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
      browser: './src/index.ts',
      node: './dist/server/index.js',
      svelte: './src/index.ts',
      default: './dist/index.js',
    });
    expect(published.exports['./button']).toEqual({
      types: './dist/components/button/index.d.ts',
      browser: './src/components/button/index.ts',
      node: './dist/server/components/button/index.js',
      svelte: './src/components/button/index.ts',
      default: './dist/components/button/index.js',
    });
    expect(published.exports['./button/schema']).toEqual({
      types: './dist/components/button/button.schema.d.ts',
      browser: './src/components/button/button.schema.ts',
      node: './dist/components/button/button.schema.js',
      svelte: './src/components/button/button.schema.ts',
      default: './dist/components/button/button.schema.js',
    });
    expect(published.exports['./button/variables']).toEqual({
      types: './dist/components/button/button.variables.d.ts',
      browser: './src/components/button/button.variables.ts',
      node: './dist/components/button/button.variables.js',
      svelte: './src/components/button/button.variables.ts',
      default: './dist/components/button/button.variables.js',
    });
    expect(published.exports['./styles/guard']).toEqual({
      types: './dist/styles/base-guard.d.ts',
      browser: './src/styles/base-guard.ts',
      node: './dist/server/styles/base-guard.js',
      svelte: './src/styles/base-guard.ts',
      default: './dist/styles/base-guard.js',
    });
    expect(files).toContain('src/components/**/*.ts');
    expect(files).toContain('src/components/**/*.svelte');
    expect(files).toContain('!dist/server/components/**/*.schema.js');
    expect(files).toContain('!dist/server/components/**/*.variables.js');
    expect(files).toContain('!dist/server/**/*.d.ts');
    expect(files).toContain('!dist/**/*.fixture.*');
    expect(files).toContain('!dist/**/*-fixture.*');
  });

  it('preserves the package-level svelte field as the source root entry', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      svelte: './src/index.ts',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);

    expect(published.svelte).toBe('./src/index.ts');
  });

  it('does not publish unexported server declaration files', () => {
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
    const files = published.files ?? [];
    const exportTargets = JSON.stringify(published.exports);

    expect(files).toContain('!dist/server/**/*.d.ts');
    expect(exportTargets).not.toContain('dist/server/index.d.ts');
    expect(exportTargets).not.toContain('dist/server/components/button/index.d.ts');
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

  it('publishes only generated component JSON sidecars used by public artifacts and the CLI', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).toContain('src/components/**/*.schema.json');
    expect(files).toContain('src/components/**/*.variables.json');
    expect(files).toContain('src/components/**/*.examples.json');
    expect(files).toContain('src/components/**/*.constraints.json');
    expect(files).not.toContain('src/components/**/*.json');
  });

  it('keeps component README files out of the published tarball', () => {
    const manifest: SourceManifest = {
      name: '@lostgradient/cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files).not.toContain('src/components/**/*.md');
    expect(files).not.toContain('!src/components/**/*.a11y.md');
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

  it('strips TypeScript syntax from staged .svelte.ts modules while preserving runes', () => {
    const source = [
      "import type { Snippet } from 'svelte';",
      "import { classNames } from './class-names.ts';",
      "type ResizeCallback = import('./use-resize-observer.types.ts').ResizeCallback;",
      'export function createState(label: string): { value: string } {',
      '  const callback: ResizeCallback | null = null;',
      '  let value = $state(label);',
      '  void callback;',
      '  return {',
      '    get value() {',
      '      return value;',
      '    },',
      '  };',
      '}',
    ].join('\n');

    const transformed = transpileSvelteTypeScriptModuleForPublish(source);

    expect(transformed).not.toContain('import type');
    expect(transformed).not.toContain(': string');
    expect(transformed).not.toContain(': { value: string }');
    expect(transformed).not.toContain("import('./use-resize-observer.types.ts')");
    expect(transformed).toContain("import { classNames } from './class-names.ts';");
    expect(transformed).toContain('$state(label)');
    expect(transformed).toContain('export function createState(label)');
  });

  it('strips TypeScript syntax from staged Svelte component script blocks', () => {
    const source = [
      '<script lang="ts" module>',
      '  export type Example = { value: string };',
      '</script>',
      '<script lang="ts">',
      '  let value = $state("ready");',
      '  function emit(event?: MouseEvent): void {',
      '    value = event?.type ?? value;',
      '  }',
      '</script>',
      '<button onclick={emit}>{value}</button>',
    ].join('\n');

    const transformed = transpileSvelteComponentScriptsForPublish(source);

    expect(transformed).toContain('<script lang="ts" module>');
    expect(transformed).toContain('<script lang="ts">');
    expect(transformed).not.toContain('export type Example');
    expect(transformed).not.toContain('event?: MouseEvent');
    expect(transformed).not.toContain(': void');
    expect(transformed).toContain('$state("ready")');
    expect(transformed).toContain('function emit(event)');
    expect(transformed).toContain('<button onclick={emit}>{value}</button>');
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
