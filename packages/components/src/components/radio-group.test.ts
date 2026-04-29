/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { createRawSnippet, mount, unmount } = await import('svelte');
const { default: RadioGroup } = await import('./radio-group.svelte');
const { default: Radio } = await import('./radio.svelte');

/**
 * RadioGroup uses Svelte context, so we need to render a parent that contains
 * actual Radio children. testing-library/svelte handles snippet props well, so
 * we render a small wrapper component inline via `createRawSnippet` that mounts
 * Radios directly.
 *
 * Since createRawSnippet renders pre-built HTML strings, we instead use Svelte's
 * mount() API directly with a wrapper component composed via JSX-like API in a
 * .svelte.ts test fixture.
 */

// Dedicated test fixture (under-test-only) that wires RadioGroup with N Radio
// children. Kept under src/test/fixtures so the convention test and exports
// drift test don't consider it a public component.
const { default: Wrapper } = await import('../test/fixtures/radio-group-fixture.svelte');

describe('RadioGroup', () => {
  test('renders a fieldset with the given legend', () => {
    const { container } = render(Wrapper, {
      legend: 'Pick one',
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    expect(container.querySelector('fieldset')).not.toBeNull();
    expect(container.querySelector('legend')?.textContent?.trim()).toBe('Pick one');
  });

  test('renders one radio input per option, sharing a name', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios.length).toBe(2);
    expect(radios[0]?.getAttribute('name')).toBe('choice');
    expect(radios[1]?.getAttribute('name')).toBe('choice');
  });

  test('only the radio matching value is checked', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'b',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  test('clicking a radio updates the bound value', async () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
    expect(a.checked).toBe(true);

    await fireEvent.click(b);
    expect(b.checked).toBe(true);
    expect(a.checked).toBe(false);
  });

  test('disabled at the group level disables every radio', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      disabled: true,
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const a = container.querySelector('#r-a') as HTMLInputElement;
    const b = container.querySelector('#r-b') as HTMLInputElement;
    expect(a.disabled).toBe(true);
    expect(b.disabled).toBe(true);
  });

  test('error sets aria-invalid on each radio', () => {
    const { container } = render(Wrapper, {
      name: 'choice',
      value: 'a',
      error: 'Required',
      options: [
        { id: 'r-a', value: 'a', label: 'A' },
        { id: 'r-b', value: 'b', label: 'B' },
      ],
    });
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios[0]?.getAttribute('aria-invalid')).toBe('true');
    expect(radios[1]?.getAttribute('aria-invalid')).toBe('true');
  });

  test('Radio outside RadioGroup throws a clear error', () => {
    let error: Error | null = null;
    try {
      const target = document.createElement('div');
      const instance = mount(Radio, {
        target,
        props: { id: 'r', value: 'x', label: 'X' },
      });
      unmount(instance);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('RadioGroup');
  });

  // Reference imports so tree-shaking doesn't drop them; they're used through
  // the Wrapper fixture above.
  test('imports are wired', () => {
    expect(typeof RadioGroup).toBe('function');
    expect(typeof Radio).toBe('function');
    expect(typeof createRawSnippet).toBe('function');
  });
});
