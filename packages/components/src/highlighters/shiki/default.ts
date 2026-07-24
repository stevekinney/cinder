import { bundledLanguages } from 'shiki/langs';
import { bundledThemes } from 'shiki/themes';

import {
  createRetryingLoaderCache,
  shikiHighlighter as createShikiHighlighter,
  type ShikiHighlighterOptions,
} from './index.ts';

export { createRetryingLoaderCache };
export type { ShikiHighlighterOptions };

/** The bundled adapter with the complete Shiki language and theme registries. */
export function shikiHighlighter(
  options: ShikiHighlighterOptions = {},
  moduleLoader?: Parameters<typeof createShikiHighlighter>[1],
): ReturnType<typeof createShikiHighlighter> {
  return createShikiHighlighter(
    {
      ...options,
      languageLoaders: options.languageLoaders ?? bundledLanguages,
      themeLoaders: options.themeLoaders ?? bundledThemes,
    },
    moduleLoader,
  );
}
