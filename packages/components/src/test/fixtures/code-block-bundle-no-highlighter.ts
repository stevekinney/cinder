/**
 * Bundle fixture for `code-block.bundle.test.ts`: a consumer that imports
 * `CodeBlock` from Cinder's root entry and renders it with a language but no
 * highlighter. A build of this file must emit no Shiki grammar and no theme.
 */
import { CodeBlock } from '@lostgradient/cinder';
import { mount } from 'svelte';

mount(CodeBlock, {
  target: document.body,
  props: { code: '{ "answer": 42 }', language: 'json' },
});
