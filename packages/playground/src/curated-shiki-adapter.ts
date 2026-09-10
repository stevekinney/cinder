/**
 * The playground's stand-in for `@lostgradient/cinder`'s bundled Shiki
 * adapter (`highlighters/shiki/default.ts`).
 *
 * `<CodeBlock>` reaches that adapter through a dynamic `import()` whenever no
 * explicit `highlighter` prop is passed. The import is lazy at runtime but not
 * at build time: the bundler still walks everything behind it to emit the
 * chunk. What is behind it is `shiki/langs` and `shiki/themes` — the complete
 * 253-grammar, 65-theme registry, 9.8 MB of source against 1.2 MB for the
 * entire rest of a page's graph.
 *
 * The playground compiles one bundle per component, so it paid that 179 times
 * over and reached 18 GB resident during the eager pre-build — an OOM kill on
 * a 16 GB CI runner, arriving as unrelated browser failures because the kill
 * carries no message of its own (CIN-523).
 *
 * This module exposes the same surface built on the `/curated` entry point,
 * and {@link curatedShikiAdapterPlugin} substitutes it for the real adapter in
 * playground builds only. Cinder's published default is untouched: a consumer
 * bundling `<CodeBlock>` builds once and keeps every grammar.
 *
 * Behavior deltas inside the playground, both deliberate:
 *
 *   - Languages narrow to `BUNDLED_LANGUAGE_LOADERS`, the same curated set
 *     `@lostgradient/markdown` uses for README fences. Anything outside it
 *     renders as escaped plaintext with one `console.warn`, never a throw —
 *     the adapter's own documented contract.
 *   - Themes narrow to `github-light` and `github-dark`, which are exactly
 *     the two the real adapter defaults to. Nothing that renders today
 *     changes appearance.
 *
 * @module
 */

import {
  shikiHighlighter as createCuratedShikiHighlighter,
  createRetryingLoaderCache,
} from '@lostgradient/cinder/highlighters/shiki/curated';
import { BUNDLED_LANGUAGE_LOADERS } from '@lostgradient/markdown/rendering/highlighter';

export { createRetryingLoaderCache };

/**
 * The two themes `highlighters/shiki/default.ts` resolves by name when no
 * `theme` option is given. Loading them individually is what lets the curated
 * entry point stay off `shiki/themes`.
 */
const DEFAULT_THEME_LOADERS = {
  'github-light': () => import('@shikijs/themes/github-light'),
  'github-dark': () => import('@shikijs/themes/github-dark'),
};

/**
 * Drop-in replacement for the published adapter's `shikiHighlighter`, with the
 * curated registries pre-applied. A caller's own `languageLoaders` or
 * `themeLoaders` still win, so the substitution never removes a choice a call
 * site made deliberately.
 */
export function shikiHighlighter(
  options: Parameters<typeof createCuratedShikiHighlighter>[0] = {},
  moduleLoader?: Parameters<typeof createCuratedShikiHighlighter>[1],
): ReturnType<typeof createCuratedShikiHighlighter> {
  return createCuratedShikiHighlighter(
    {
      ...options,
      languageLoaders: options.languageLoaders ?? BUNDLED_LANGUAGE_LOADERS,
      themeLoaders: options.themeLoaders ?? DEFAULT_THEME_LOADERS,
    },
    moduleLoader,
  );
}
