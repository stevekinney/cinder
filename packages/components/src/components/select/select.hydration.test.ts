/// <reference lib="dom" />
/**
 * Hydration contract for Select.
 *
 * Select wires aria/description ids derived from `id` and renders a native
 * `<select>` with one `<option>` per entry. The hydrated client must reuse the
 * exact ids the server emitted so ARIA wiring and the option list stay intact.
 */
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

const { default: Select } = await import('./select.svelte');
const sourcePath = new URL('./select.svelte', import.meta.url).pathname;

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select hydration', () => {
  test('hydrates without warnings and preserves the native select id', async () => {
    const result = await renderThenHydrate(Select, sourcePath, {
      id: 'fruit',
      value: 'b',
      label: 'Fruit',
      options,
    });

    try {
      const select = result.container.querySelector<HTMLSelectElement>('select#fruit');
      expect(select).not.toBeNull();
      expect(result.container.querySelectorAll('option')).toHaveLength(3);

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });

  test('description and error ids survive hydration consistently', async () => {
    const result = await renderThenHydrate(Select, sourcePath, {
      id: 'sized',
      value: 'a',
      label: 'Sized',
      description: 'Pick one',
      error: 'Required',
      options,
    });

    try {
      const select = result.container.querySelector<HTMLSelectElement>('select#sized');
      const describedBy = select?.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('sized');
      // Every referenced description/error node exists in the hydrated tree.
      for (const referencedId of describedBy.split(/\s+/).filter(Boolean)) {
        expect(result.container.querySelector(`#${referencedId}`)).not.toBeNull();
      }
    } finally {
      result.cleanup();
    }
  });
});
