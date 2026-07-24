import { shikiHighlighter } from '../../../src/highlighters/shiki/index.ts';
export const highlighter = shikiHighlighter({
  languageLoaders: { typescript: () => import('@shikijs/langs/typescript') },
  themeLoaders: { 'github-light': () => import('@shikijs/themes/github-light') },
  theme: 'github-light',
});

void highlighter('const answer = 42;', 'typescript');
