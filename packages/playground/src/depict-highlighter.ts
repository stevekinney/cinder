/**
 * The playground's shared `<CodeBlock>` highlighter, on the `depict` theme.
 *
 * Two syntax-highlighting paths run side by side in the playground:
 *
 *   1. Markdown fences (README prose) go through `@lostgradient/markdown`'s
 *      rehype-shiki step, which highlights with `CSS_VARIABLE_THEME` — the
 *      `depict` theme, whose every color is a `var(--…)` reference resolved
 *      at paint time against the declarations in `render-shell.ts`.
 *   2. `<CodeBlock>` instances go through Cinder's Shiki adapter, which
 *      defaults to `{ light: 'github-light', dark: 'github-dark' }`.
 *
 * Path 2's default is where the baked `background-color:#fff` on playground
 * code blocks comes from: it is emitted by Shiki's own bundled `github-light`
 * theme, so there is no hex literal in this repo to delete. Registering the
 * same `depict` theme for path 2 puts both on one palette that follows the
 * active light/dark theme instead of pinning a light background.
 *
 * `themeLoaders` replaces the theme registry with just `depict`; language
 * grammars still come from Shiki's full bundle, because the default
 * `@lostgradient/cinder/highlighters/shiki` entry point falls back to
 * `shiki/langs`'s `bundledLanguages` whenever `languageLoaders` is omitted.
 * Importing the `/curated` entry point instead would leave the language
 * registry empty and silently render every fence as plaintext.
 *
 * Module-scoped singleton: the adapter caches its Shiki module (and therefore
 * its WASM engine and loaded grammars) per instance, so every `<CodeBlock>`
 * should share this one rather than constructing its own.
 *
 * @module
 */

import type { Highlighter } from '@lostgradient/cinder';
import { shikiHighlighter } from '@lostgradient/cinder/highlighters/shiki';
import { CSS_VARIABLE_THEME } from '@lostgradient/markdown/rendering/highlighter';

/**
 * Shared `depict`-themed highlighter for `<CodeBlock highlighter={…} />`.
 *
 * The factory is synchronous and Shiki is imported lazily on the first
 * highlight call, so merely importing this module ships no Shiki bytes.
 */
export const depictHighlighter: Highlighter = shikiHighlighter({
  theme: 'depict',
  themeLoaders: {
    depict: async () => ({ default: CSS_VARIABLE_THEME }),
  },
});
