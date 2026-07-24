import {
  createRetryingLoaderCache,
  shikiHighlighter as createShikiHighlighter,
  createShikiModule,
  type ShikiHighlighterOptions,
} from './index.ts';

export { createRetryingLoaderCache };
export type { ShikiHighlighterOptions };

/** The bundled adapter with the complete Shiki language and theme registries. */
export function shikiHighlighter(
  options: ShikiHighlighterOptions = {},
  moduleLoader?: Parameters<typeof createShikiHighlighter>[1],
): ReturnType<typeof createShikiHighlighter> {
  const loadModule =
    moduleLoader ??
    (async () => {
      const [{ bundledLanguages }, { bundledThemes }] = await Promise.all([
        import('shiki/langs'),
        import('shiki/themes'),
      ]);
      return createShikiModule(
        options.languageLoaders ?? bundledLanguages,
        options.themeLoaders ?? bundledThemes,
      );
    });
  return createShikiHighlighter(options, loadModule);
}
