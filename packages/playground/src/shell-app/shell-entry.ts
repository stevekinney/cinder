/**
 * Entry point for the playground shell SPA bundle.
 *
 * Reads the `<script type="application/json" id="cinder-initial">` data island
 * embedded by `render-shell.ts` to get the initial component name and the
 * full sidebar component list, then hydrates the server-rendered Svelte shell
 * in `#shell-root`.
 *
 * The data-island pattern is used instead of a `window.__GLOBAL__` to avoid
 * any risk of `</script>` injection through the embedded payload, even though
 * payload values are filesystem-derived and kebab-case-validated server-side.
 */

import { hydrate } from 'svelte';

import { parseInitialData, type InitialData } from './shell-initial-data.ts';
import Shell from './shell.svelte';

function readInitialData(): InitialData {
  const node = document.getElementById('cinder-initial');
  if (!node)
    return {
      component: '',
      components: [],
      readmeHtml: '',
      documentation: null,
      initialSearch: '',
    };
  try {
    const parsed: unknown = JSON.parse(node.textContent ?? '{}');
    const initialData = parseInitialData(parsed);
    if (initialData !== null) return initialData;
  } catch (error) {
    console.error('[cinder playground] failed to parse #cinder-initial:', error);
  }
  return {
    component: '',
    components: [],
    readmeHtml: '',
    documentation: null,
    initialSearch: '',
  };
}

const initial = readInitialData();

const target = document.getElementById('shell-root');
if (target === null) {
  throw new Error('[cinder playground] #shell-root target not found');
}

hydrate(Shell, {
  target,
  props: {
    initialComponent: initial.component,
    components: initial.components,
    readmeHtml: initial.readmeHtml,
    documentation: initial.documentation,
    initialSearch: initial.initialSearch,
  },
});
