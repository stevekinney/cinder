/// <reference lib="dom" />
/**
 * Hydration contract for Select.
 *
 * Select wires aria/description ids derived from `id` and renders a native
 * `<select>` with one `<option>` per entry. The hydrated client must reuse the
 * exact ids the server emitted so ARIA wiring and the option list stay intact.
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

const { default: Select } = await import('./select.svelte');
const sourcePath = new URL('./select.svelte', import.meta.url).pathname;

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];
const fruitProps = { id: 'fruit', value: 'b', label: 'Fruit', options };
const sizedProps = {
  id: 'sized',
  value: 'a',
  label: 'Sized',
  description: 'Pick one',
  error: 'Required',
  options,
};
await prepareSvelteServerSource(sourcePath);
// Server rendering spawns a Bun process, so it runs once at module scope, off bun's per-test clock.
const [fruitHtml, sizedHtml] = await Promise.all([
  renderSvelteOnServer(sourcePath, fruitProps),
  renderSvelteOnServer(sourcePath, sizedProps),
]);

describe('Select hydration', () => {
  test('hydrates without warnings and preserves the native select id', async () => {
    const result = hydrateServerHtml(Select, fruitHtml, fruitProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      const select = result.container.querySelector<HTMLSelectElement>('select#fruit');
      expect(select).not.toBeNull();
      expect(result.container.querySelectorAll('option')).toHaveLength(3);

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      await result.cleanup();
    }
  });

  test('description and error ids survive hydration consistently', async () => {
    const result = hydrateServerHtml(Select, sizedHtml, sizedProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      const select = result.container.querySelector<HTMLSelectElement>('select#sized');
      const describedBy = select?.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('sized');
      // Every referenced description/error node exists in the hydrated tree.
      for (const referencedId of describedBy.split(/\s+/).filter(Boolean)) {
        expect(result.container.querySelector(`#${referencedId}`)).not.toBeNull();
      }
    } finally {
      await result.cleanup();
    }
  });
});
