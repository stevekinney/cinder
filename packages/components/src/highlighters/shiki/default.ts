import {
  createRetryingLoaderCache,
  shikiHighlighter as createShikiHighlighter,
  createShikiModule,
  type ShikiHighlighterOptions,
} from './index.ts';

export { createRetryingLoaderCache };
export type { ShikiHighlighterOptions };

type ShikiModule = Awaited<ReturnType<typeof createShikiModule>>;
let sharedDefaultModuleLoader: (() => Promise<ShikiModule>) | undefined;

function getDefaultModuleLoader(): () => Promise<ShikiModule> {
  sharedDefaultModuleLoader ??= createRetryingLoaderCache(async () => {
    const [{ bundledLanguages }, { bundledThemes }] = await Promise.all([
      import('shiki/langs'),
      import('shiki/themes'),
    ]);
    return createShikiModule(bundledLanguages, bundledThemes, false);
  });
  return sharedDefaultModuleLoader;
}

/**
 * The Shiki adapter with the complete Shiki language and theme registries,
 * exported from the package root as `fullShikiHighlighter`.
 *
 * Every grammar and theme Shiki ships is reachable from here through the
 * `shiki/langs` and `shiki/themes` lookup tables, so a bundler that sees this
 * module emits all of them as lazy chunks. Nothing else in cinder imports it,
 * and `<CodeBlock>` never falls back to it: only an application that chooses
 * automatic highlighting of arbitrary languages pays for the registries. Pass
 * an instance to `setCodeHighlighterContext` (or to a block's `highlighter`
 * prop). An application that knows its languages should prefer
 * `shikiHighlighter` with explicit `languageLoaders` and `themeLoaders`.
 */
export function shikiHighlighter(
  options: ShikiHighlighterOptions = {},
  moduleLoader?: Parameters<typeof createShikiHighlighter>[1],
): ReturnType<typeof createShikiHighlighter> {
  const loadModule =
    moduleLoader ??
    (options.languageLoaders === undefined && options.themeLoaders === undefined
      ? getDefaultModuleLoader()
      : async () => {
          const [{ bundledLanguages }, { bundledThemes }] = await Promise.all([
            import('shiki/langs'),
            import('shiki/themes'),
          ]);
          return createShikiModule(
            options.languageLoaders ?? bundledLanguages,
            options.themeLoaders ?? bundledThemes,
            options.languageLoaders !== undefined,
          );
        });
  return createShikiHighlighter(options, loadModule);
}
