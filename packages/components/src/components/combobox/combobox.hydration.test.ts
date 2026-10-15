/// <reference lib="dom" />
/**
 * Hydration contract for Combobox.
 *
 * The combobox input keeps its role/state wiring stable across hydration. The
 * popup-specific attributes (`aria-controls`, `aria-activedescendant`) are only
 * emitted while the listbox exists.
 */
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { hydrateServerHtml, renderSvelteOnServer, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { default: Combobox } = await import('./combobox.svelte');
const sourcePath = new URL('./combobox.svelte', import.meta.url).pathname;

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
];
const fruitProps = { id: 'fruit', label: 'Fruit', options: fruits };
// Server rendering spawns a Bun process, so it runs once at module scope, off bun's per-test clock.
const fruitHtml = await renderSvelteOnServer(sourcePath, fruitProps);

describe('Combobox hydration', () => {
  test('hydrates without warnings and keeps role="combobox"', async () => {
    const result = hydrateServerHtml(Combobox, fruitHtml, fruitProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      const input = result.container.querySelector('[role="combobox"]');
      expect(input).not.toBeNull();
      expect(input?.id).toBe('fruit');

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      await result.cleanup();
    }
  });

  test('closed combobox omits popup references before and after hydration', async () => {
    const result = hydrateServerHtml(Combobox, fruitHtml, fruitProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      expect(result.ssrHtml).not.toContain('aria-controls=');
      const input = result.container.querySelector('[role="combobox"]');
      expect(input?.hasAttribute('aria-controls')).toBe(false);
      expect(input?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      await result.cleanup();
    }
  });
});
