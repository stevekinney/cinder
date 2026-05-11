/**
 * Entry point for the playground shell SPA bundle.
 *
 * Reads the `<script type="application/json" id="cinder-initial">` data island
 * embedded by `render-shell.ts` to get the initial component name and the
 * full sidebar component list, then mounts the Svelte shell into `#shell-root`.
 *
 * The data-island pattern is used instead of a `window.__GLOBAL__` to avoid
 * any risk of `</script>` injection through the embedded payload, even though
 * payload values are filesystem-derived and kebab-case-validated server-side.
 */

import { mount } from 'svelte';

import Shell from './shell.svelte';

type InitialData = { component: string; components: string[] };

function readInitialData(): InitialData {
  const node = document.getElementById('cinder-initial');
  if (!node) return { component: '', components: [] };
  try {
    const parsed = JSON.parse(node.textContent ?? '{}') as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as InitialData).component === 'string' &&
      Array.isArray((parsed as InitialData).components)
    ) {
      return parsed as InitialData;
    }
  } catch (error) {
    console.error('[cinder playground] failed to parse #cinder-initial:', error);
  }
  return { component: '', components: [] };
}

const initial = readInitialData();

const target = document.getElementById('shell-root');
if (target === null) {
  throw new Error('[cinder playground] #shell-root target not found');
}

mount(Shell, {
  target,
  props: {
    initialComponent: initial.component,
    components: initial.components,
  },
});
