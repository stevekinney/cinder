/**
 * Bundle fixture for `code-block.bundle.test.ts`: a consumer that imports
 * `CodeBlock` from Cinder's root entry and renders it with an explicit
 * highlighter that registers only the `json` grammar and the `github-light`
 * theme. A build of this file must emit exactly that grammar and that theme.
 */
import { CodeBlock, shikiHighlighter } from '@lostgradient/cinder';
import { mount } from 'svelte';

const highlighter = shikiHighlighter({
  theme: 'github-light',
  languageLoaders: { json: () => import('@shikijs/langs/json') },
  themeLoaders: { 'github-light': () => import('@shikijs/themes/github-light') },
});

mount(CodeBlock, {
  target: document.body,
  props: { code: '{ "answer": 42 }', language: 'json', highlighter },
});
