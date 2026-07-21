/// <reference lib="dom" />
/**
 * Hydration contract for Combobox.
 *
 * The combobox input carries `aria-controls` pointing at the listbox id
 * (`{id}-listbox`) and `aria-activedescendant`. Those references must survive
 * hydration so assistive tech keeps the input wired to its popup.
 */
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { prepareHydrationSource, renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

const { default: Combobox } = await import('./combobox.svelte');
const sourcePath = new URL('./combobox.svelte', import.meta.url).pathname;
await prepareHydrationSource(sourcePath);

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
];

describe('Combobox hydration', () => {
  test('hydrates without warnings and keeps role="combobox"', async () => {
    const result = await renderThenHydrate(Combobox, sourcePath, {
      id: 'fruit',
      label: 'Fruit',
      options: fruits,
    });

    try {
      const input = result.container.querySelector('[role="combobox"]');
      expect(input).not.toBeNull();
      expect(input?.id).toBe('fruit');

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });

  test('aria-controls points at the same listbox id before and after hydration', async () => {
    const result = await renderThenHydrate(Combobox, sourcePath, {
      id: 'fruit',
      label: 'Fruit',
      options: fruits,
    });

    try {
      // The id pattern is deterministic, so the SSR HTML and the hydrated DOM
      // must agree on the listbox id reference.
      expect(result.ssrHtml).toContain('aria-controls="fruit-listbox"');
      const input = result.container.querySelector('[role="combobox"]');
      expect(input?.getAttribute('aria-controls')).toBe('fruit-listbox');
    } finally {
      result.cleanup();
    }
  });
});
