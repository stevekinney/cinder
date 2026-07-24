/// <reference lib="dom" />
/**
 * Hydration contract for Combobox.
 *
 * The combobox input keeps its role/state wiring stable across hydration. The
 * popup-specific attributes (`aria-controls`, `aria-activedescendant`) are only
 * emitted while the listbox exists.
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

  test('closed combobox omits popup references before and after hydration', async () => {
    const result = await renderThenHydrate(Combobox, sourcePath, {
      id: 'fruit',
      label: 'Fruit',
      options: fruits,
    });

    try {
      expect(result.ssrHtml).not.toContain('aria-controls=');
      const input = result.container.querySelector('[role="combobox"]');
      expect(input?.hasAttribute('aria-controls')).toBe(false);
      expect(input?.getAttribute('aria-expanded')).toBe('false');
    } finally {
      result.cleanup();
    }
  });
});
