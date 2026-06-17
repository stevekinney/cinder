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

type InitialData = { component: string; components: string[]; readmeHtml: string };

function getOwnProperty(value: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

/**
 * Validate that the parsed JSON payload matches the expected `InitialData`
 * shape and that every component name in the list satisfies the kebab-case
 * invariant the server enforces. This is defense-in-depth: render-shell
 * already validates server-side, but treating the data island as untrusted
 * input keeps the boundary explicit.
 */
function isInitialData(value: unknown): value is InitialData {
  if (typeof value !== 'object' || value === null) return false;
  const component = getOwnProperty(value, 'component');
  const components = getOwnProperty(value, 'components');
  const readmeHtml = getOwnProperty(value, 'readmeHtml');
  if (typeof component !== 'string') return false;
  if (!Array.isArray(components)) return false;
  if (typeof readmeHtml !== 'string') return false;
  const componentNamePattern = /^[a-z0-9][a-z0-9-]*$/;
  // The active component can legitimately be absent from `components`: the
  // server lists only sidebar-eligible components there (those with at least
  // one .example.svelte), but `/c/<name>` accepts any discovered component.
  // So we validate the component name's shape but NOT membership in the
  // sidebar list — that would wipe the sidebar for a perfectly valid URL
  // like /c/radio.
  if (component !== '' && !componentNamePattern.test(component)) return false;
  for (const item of components) {
    if (typeof item !== 'string' || !componentNamePattern.test(item)) return false;
  }
  return true;
}

function readInitialData(): InitialData {
  const node = document.getElementById('cinder-initial');
  if (!node) return { component: '', components: [], readmeHtml: '' };
  try {
    const parsed: unknown = JSON.parse(node.textContent ?? '{}');
    if (isInitialData(parsed)) return parsed;
  } catch (error) {
    console.error('[cinder playground] failed to parse #cinder-initial:', error);
  }
  return { component: '', components: [], readmeHtml: '' };
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
    readmeHtml: initial.readmeHtml,
  },
});
