import type { BunPlugin } from 'bun';

/**
 * Configuration for {@link cssImportPlugin}.
 */
export type CssImportPluginOptions = {
  /**
   * Map of per-component `index.ts` absolute path → the `@lostgradient/cinder/<name>/styles`
   * (or `@lostgradient/cinder/experimental/<name>/styles`) specifier its directory's sidecar
   * resolves to. Each entry gets that import prepended so the SUBPATH bundle
   * (`dist/components/<name>/index.js`, resolved by `import Button from
   * '@lostgradient/cinder/button'`) auto-pulls its own styles. Passing the resolved specifier
   * explicitly — rather than deriving it from the directory basename — keeps
   * experimental components (whose export is `@lostgradient/cinder/experimental/<name>/styles`)
   * correct.
   */
  perComponentStyleSpecifiers: ReadonlyMap<string, string>;
  /**
   * Absolute path of the root barrel entry (`src/index.ts`).
   */
  rootBarrelEntrypoint: string;
  /**
   * Every component-styles specifier the root barrel must load, injected
   * DIRECTLY into the barrel entry rather than relied upon transitively:
   * re-exported modules' side-effect imports are tree-shaken away under
   * `sideEffects: ["**​/*.css"]` (which marks JS modules side-effect-free),
   * but side-effect imports in the ENTRY file itself are always preserved (the
   * entry is the bundle root, so nothing tree-shakes against it). The root
   * barrel is the documented non-tree-shaken "everything" convenience path
   * (`import { Button } from '@lostgradient/cinder'`), so loading every used component's CSS
   * there matches its semantics.
   */
  rootBarrelStyleSpecifiers: readonly string[];
};

/**
 * Build-time CSS auto-import plugin for the BROWSER per-component build.
 *
 * Historically a consumer had to hand-write `import '@lostgradient/cinder/<name>/styles'` for
 * EVERY component they used, or the component rendered silently unstyled. This
 * plugin removes that footgun: `import Button from '@lostgradient/cinder/button'` and
 * `import { Button } from '@lostgradient/cinder'` both auto-pull the component's styles.
 *
 * Why `@lostgradient/cinder/<name>/styles` and not a relative `./<name>.css`?
 * `splitting: false` bundles each component module into BOTH its own subpath
 * output (`dist/components/<name>/index.js`) AND the root barrel
 * (`dist/index.js`), which live at different directory depths. A relative
 * `./<name>.css` literal cannot resolve correctly from both locations. A bare
 * self-referential `@lostgradient/cinder/<name>/styles` specifier resolves through the
 * package's own `exports` map identically regardless of which output file
 * carries it — and `@lostgradient/cinder`/`@lostgradient/cinder/*` is already external in the browser
 * build, so the specifier survives bundling verbatim and is never inlined.
 *
 * This plugin is wired into the BROWSER build ONLY. The SERVER (`node`)
 * build never receives it, so server entries stay CSS-free — a bare CSS
 * import under the `node` condition would throw `ERR_UNKNOWN_FILE_EXTENSION`
 * in plain Node SSR. The browser-only split is the whole point.
 *
 * Two injection sites:
 *   - Per-component SUBPATH entries get the import prepended to their own
 *     module so the subpath bundle carries exactly its own styles.
 *   - The root BARREL entry gets every used component's import prepended
 *     directly, because the transitive imports would otherwise be
 *     tree-shaken (see {@link CssImportPluginOptions.rootBarrelStyleSpecifiers}).
 *
 * The deprecated experimental alias shims carry no sidecar of their own and
 * re-export the promoted component, whose subpath entry already injects its
 * own styles in this same pass — so they need no special handling.
 */
/** Normalize a filesystem path to forward slashes so path comparisons hold
 *  regardless of the OS separator Bun reports — matches `svelte-plugin.ts`. */
function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

export function cssImportPlugin(options: CssImportPluginOptions): BunPlugin {
  const barrelInjection = options.rootBarrelStyleSpecifiers
    .map((specifier) => `import '${specifier}';`)
    .join('\n');
  // Normalize the entrypoint key and the per-component map up front so an
  // OS-separator mismatch between these keys and Bun's `onLoad` path can never
  // silently skip injection (which would ship unstyled components or fail the
  // build gate).
  const rootBarrelEntrypoint = normalizePath(options.rootBarrelEntrypoint);
  const perComponentStyleSpecifiers = new Map(
    [...options.perComponentStyleSpecifiers].map(([path, specifier]) => [
      normalizePath(path),
      specifier,
    ]),
  );
  return {
    name: 'cinder-css-import',
    setup(builder) {
      builder.onLoad({ filter: /\/index\.ts$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const normalized = normalizePath(path);

        if (normalized === rootBarrelEntrypoint) {
          return {
            contents: barrelInjection === '' ? source : `${barrelInjection}\n${source}`,
            loader: 'ts',
          };
        }

        const specifier = perComponentStyleSpecifiers.get(normalized);
        if (specifier === undefined) {
          return { contents: source, loader: 'ts' };
        }

        // The SOURCE index.ts already leads with a relative `import './<name>.css'`
        // (for the `svelte` condition, which resolves source). That relative
        // import is NOT external, so Bun would INLINE the sidecar into the dist
        // JS — while we also inject the EXTERNAL `@lostgradient/cinder/<name>/styles` below,
        // producing a double load. Strip the one leading relative sidecar import
        // from the loaded source so dist references the public styles entry
        // exactly once. The on-disk source file is untouched (the svelte path
        // keeps its relative import). Throw if the expected import is absent —
        // that means the source-css gate drifted and the fix would silently
        // regress to inlining.
        const componentName = normalized.split('/').at(-2) ?? '';
        // Match the sidecar import statement on its own line WHEREVER it sits in
        // the import block — prettier's import sort can move it below a sibling
        // import, so it is not always line 1. The pattern is anchored to this
        // component's exact sidecar name (not a generic `./*.css`), so it strips
        // exactly one known import and never an unrelated CSS import.
        const sidecarImportPattern = new RegExp(
          `^import\\s+["']\\./${componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.css["'];?[^\\n]*\\r?\\n`,
          'm',
        );
        const stripped = source.replace(sidecarImportPattern, '');
        if (stripped === source) {
          throw new Error(
            `[cinder-css-import] expected a leading \`import './${componentName}.css'\` in ${path} ` +
              `(run \`bun run styles:source-css\`); refusing to inject \`${specifier}\` over an inlined sidecar.`,
          );
        }

        return { contents: `import '${specifier}';\n${stripped}`, loader: 'ts' };
      });
    },
  };
}

/**
 * The self-referential CSS specifier injected for a component, matching the
 * shape of its `./<name>/styles` (or `./experimental/<name>/styles`) export.
 * Exported so the build, its contract gate, and the smoke test all agree on
 * the exact string that lands in (browser) and is absent from (server) output.
 */
export function componentStylesSpecifier(name: string, isExperimental: boolean): string {
  return isExperimental
    ? `@lostgradient/cinder/experimental/${name}/styles`
    : `@lostgradient/cinder/${name}/styles`;
}
