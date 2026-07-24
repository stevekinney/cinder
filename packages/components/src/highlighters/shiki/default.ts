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

/** The bundled adapter with the complete Shiki language and theme registries. */
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
