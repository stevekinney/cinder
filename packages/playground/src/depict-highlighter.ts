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
 * Both paths now share ONE curated grammar set. This module used to reach the
 * default `@lostgradient/cinder/highlighters/shiki` entry point, whose every
 * branch loads `shiki/langs` and `shiki/themes` — the complete 253-grammar,
 * 65-theme registry — even when `themeLoaders` is supplied. A dynamic
 * `import()` defers the download but not the build: the bundler still walks
 * that registry to emit its chunk, once per page bundle. At 179 page bundles
 * that was 9.8 MB of grammar source per graph against 1.2 MB for everything
 * else combined, and it took the playground's eager pre-build to 18 GB
 * resident — an OOM kill on a 16 GB CI runner (CIN-523).
 *
 * The `/curated` entry point takes explicit registries instead. It renders
 * every language as plaintext if given none, which is why this passes
 * `BUNDLED_LANGUAGE_LOADERS` — the same map `@lostgradient/markdown`'s
 * rehype-shiki step already uses for path 1. Adding a language means adding
 * it there, once, for both paths.
 *
 * A language outside that set is not an error: the adapter's documented
 * contract is escaped plaintext plus one `console.warn` per language, never
 * a throw.
 *
 * Module-scoped singleton: the adapter caches its Shiki module (and therefore
 * its WASM engine and loaded grammars) per instance, so every `<CodeBlock>`
 * should share this one rather than constructing its own.
 *
 * @module
 */

import type { Highlighter } from '@lostgradient/cinder';
import { shikiHighlighter } from '@lostgradient/cinder/highlighters/shiki/curated';
import {
  BUNDLED_LANGUAGE_LOADERS,
  CSS_VARIABLE_THEME,
} from '@lostgradient/markdown/rendering/highlighter';

/**
 * Shared `depict`-themed highlighter for `<CodeBlock highlighter={…} />`.
 *
 * The factory is synchronous and Shiki is imported lazily on the first
 * highlight call, so merely importing this module ships no Shiki bytes.
 */
export const depictHighlighter: Highlighter = shikiHighlighter({
  theme: 'depict',
  languageLoaders: BUNDLED_LANGUAGE_LOADERS,
  themeLoaders: {
    depict: async () => ({ default: CSS_VARIABLE_THEME }),
  },
});

/**
 * Highlight a single inline code surface with the same Shiki pipeline without
 * nesting the block highlighter's `<pre><code>` frame inside a text span.
 */
export async function depictInlineHighlighter(code: string, language: string): Promise<string> {
  const html = await depictHighlighter(code, language);
  const match = /<code>([\s\S]*)<\/code>/.exec(html);
  return match?.[1] ?? '';
}
