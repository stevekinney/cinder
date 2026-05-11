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

/**
 * Validate that the parsed JSON payload matches the expected `InitialData`
 * shape and that every component name in the list satisfies the kebab-case
 * invariant the server enforces. This is defense-in-depth: render-shell
 * already validates server-side, but treating the data island as untrusted
 * input keeps the boundary explicit.
 */
function isInitialData(value: unknown): value is InitialData {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.component !== 'string') return false;
  if (!Array.isArray(record.components)) return false;
  const componentNamePattern = /^[a-z0-9][a-z0-9-]*$/;
  for (const item of record.components) {
    if (typeof item !== 'string' || !componentNamePattern.test(item)) return false;
  }
  // The initial component must either be empty (no-component placeholder) or
  // present in the validated components list — otherwise the sidebar's
  // current-selection state would point at an unknown entry.
  if (record.component !== '' && !record.components.includes(record.component)) return false;
  return true;
}

function readInitialData(): InitialData {
  const node = document.getElementById('cinder-initial');
  if (!node) return { component: '', components: [] };
  try {
    const parsed: unknown = JSON.parse(node.textContent ?? '{}');
    if (isInitialData(parsed)) return parsed;
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
