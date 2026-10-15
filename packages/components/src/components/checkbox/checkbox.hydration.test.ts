/// <reference lib="dom" />
/**
 * Hydration contract for Checkbox.
 *
 * `indeterminate` is a DOM *property*, not an attribute — it cannot appear in
 * the server HTML and is set on the live input only after hydration runs the
 * sync effect. These tests prove the SSR markup and the hydrated client agree
 * and that the property lands post-hydration without warnings.
 */
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  hydrateServerHtml,
  prepareSvelteServerSource,
  renderSvelteOnServer,
  setupHappyDom,
} from '@lostgradient/testing';

setupHappyDom();

const { default: Checkbox } = await import('./checkbox.svelte');
const sourcePath = new URL('./checkbox.svelte', import.meta.url).pathname;
await prepareSvelteServerSource(sourcePath);
// Server rendering spawns a Bun process, so it runs once at module scope, off bun's per-test clock.
const defaultProps = { id: 'agree', label: 'I agree' };
const indeterminateProps = { id: 'parent', label: 'Select all', indeterminate: true };
const [defaultHtml, indeterminateHtml] = await Promise.all([
  renderSvelteOnServer(sourcePath, defaultProps),
  renderSvelteOnServer(sourcePath, indeterminateProps),
]);

describe('Checkbox hydration', () => {
  test('hydrates without warnings and keeps the checkbox role/id stable', async () => {
    const result = hydrateServerHtml(Checkbox, defaultHtml, defaultProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      const input = result.container.querySelector<HTMLInputElement>('#agree');
      expect(input).not.toBeNull();
      expect(input?.getAttribute('type')).toBe('checkbox');

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      await result.cleanup();
    }
  });

  test('indeterminate is absent from SSR HTML but set as a DOM property after hydration', async () => {
    const result = hydrateServerHtml(Checkbox, indeterminateHtml, indeterminateProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      // The attribute never appears in server markup — it is a property.
      expect(result.ssrHtml).not.toContain('indeterminate');

      const input = result.container.querySelector<HTMLInputElement>('#parent');
      expect(input).not.toBeNull();
      // After hydration the sync effect sets the live DOM property.
      expect(input?.indeterminate).toBe(true);
    } finally {
      await result.cleanup();
    }
  });
});
