import { shikiHighlighter } from '@lostgradient/cinder';

/** Shared curated highlighter for the console's syntax-highlighted CodeBlocks. */
export const codeHighlighter = shikiHighlighter({
  theme: { light: 'github-light', dark: 'github-dark' },
  languageLoaders: {
    json: () => import('@shikijs/langs/json'),
    typescript: () => import('@shikijs/langs/typescript'),
  },
  themeLoaders: {
    'github-light': () => import('@shikijs/themes/github-light'),
    'github-dark': () => import('@shikijs/themes/github-dark'),
  },
});
