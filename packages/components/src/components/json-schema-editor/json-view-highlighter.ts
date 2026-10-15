/**
 * The JSON view's own highlighter.
 *
 * The JSON view only ever renders JSON, so it carries a curated highlighter
 * whose only grammar is `json` and highlights with no context provider. Its
 * themes are the adapter's default light/dark pair, so the view follows
 * cinder's color scheme. A consumer bundle that renders the view ships that one
 * grammar and those two themes, never Shiki's full registries.
 *
 * One module-scoped instance, so every JSON view shares one Shiki module and
 * the grammar it loaded.
 */

import { shikiHighlighter } from '../../highlighters/shiki/index.ts';
import type { Highlighter } from '../../utilities/highlighter.ts';

export const jsonViewHighlighter: Highlighter = /* @__PURE__ */ shikiHighlighter({
  languageLoaders: { json: () => import('@shikijs/langs/json') },
  themeLoaders: {
    'github-light': () => import('@shikijs/themes/github-light'),
    'github-dark': () => import('@shikijs/themes/github-dark'),
  },
});
