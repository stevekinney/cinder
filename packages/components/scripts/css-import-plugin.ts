import type { BunPlugin } from 'bun';

/**
 * Configuration for {@link cssImportPlugin}.
 */
export type CssImportPluginOptions = {
  /**
   * Map of per-component `index.ts` absolute path → the `cinder/<name>/styles`
   * (or `cinder/experimental/<name>/styles`) specifier its directory's sidecar
   * resolves to. Each entry gets that import prepended so the SUBPATH bundle
   * (`dist/components/<name>/index.js`, resolved by `import Button from
   * 'cinder/button'`) auto-pulls its own styles. Passing the resolved specifier
   * explicitly — rather than deriving it from the directory basename — keeps
   * experimental components (whose export is `cinder/experimental/<name>/styles`)
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
   * (`import { Button } from 'cinder'`), so loading every used component's CSS
   * there matches its semantics.
   */
  rootBarrelStyleSpecifiers: readonly string[];
};

/**
 * Build-time CSS auto-import plugin for the BROWSER per-component build.
 *
 * Historically a consumer had to hand-write `import 'cinder/<name>/styles'` for
 * EVERY component they used, or the component rendered silently unstyled. This
 * plugin removes that footgun: `import Button from 'cinder/button'` and
 * `import { Button } from 'cinder'` both auto-pull the component's styles.
 *
 * Why `cinder/<name>/styles` and not a relative `./<name>.css`?
 * `splitting: false` bundles each component module into BOTH its own subpath
 * output (`dist/components/<name>/index.js`) AND the root barrel
 * (`dist/index.js`), which live at different directory depths. A relative
 * `./<name>.css` literal cannot resolve correctly from both locations. A bare
 * self-referential `cinder/<name>/styles` specifier resolves through the
 * package's own `exports` map identically regardless of which output file
 * carries it — and `cinder`/`cinder/*` is already external in the browser
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
export function cssImportPlugin(options: CssImportPluginOptions): BunPlugin {
  const barrelInjection = options.rootBarrelStyleSpecifiers
    .map((specifier) => `import '${specifier}';`)
    .join('\n');
  return {
    name: 'cinder-css-import',
    setup(builder) {
      builder.onLoad({ filter: /\/index\.ts$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();

        if (path === options.rootBarrelEntrypoint) {
          return {
            contents: barrelInjection === '' ? source : `${barrelInjection}\n${source}`,
            loader: 'ts',
          };
        }

        const specifier = options.perComponentStyleSpecifiers.get(path);
        if (specifier === undefined) {
          return { contents: source, loader: 'ts' };
        }

        return { contents: `import '${specifier}';\n${source}`, loader: 'ts' };
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
  return isExperimental ? `cinder/experimental/${name}/styles` : `cinder/${name}/styles`;
}
