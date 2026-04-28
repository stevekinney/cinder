/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { describe, expect, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// Extend Bun's expect with @testing-library/jest-dom matchers (e.g. toBeDisabled, toBeVisible).
// The cast to `Parameters<typeof expect.extend>[0]` satisfies Bun's extend signature while
// preserving the full jest-dom matcher set at runtime.
expect.extend(matchers as Parameters<typeof expect.extend>[0]);

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Select } = await import('./select.svelte');

const defaultOptions = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select', () => {
  test('renders <select id={id}> with one <option> per option in options array', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select#test-select');
    expect(selectEl).not.toBeNull();
    // Non-null assertion is safe: the expect above would have thrown if selectEl were null.
    const optionEls = Array.from(selectEl!.querySelectorAll('option'));
    expect(optionEls.length).toBe(3);
    expect(optionEls[0]!.getAttribute('value')).toBe('a');
    expect(optionEls[0]!.textContent).toBe('Option A');
    expect(optionEls[1]!.getAttribute('value')).toBe('b');
    expect(optionEls[2]!.getAttribute('value')).toBe('c');
  });

  test('<select> value matches initial bound value', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'b', options: defaultOptions },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    expect(selectEl.value).toBe('b');
  });

  test('<select> is actually disabled when disabled=true', () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions, disabled: true },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    // toBeDisabled() from @testing-library/jest-dom checks the native disabled attribute.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (expect(selectEl) as any).toBeDisabled();
  });

  test('label prop creates <label for={id}>', () => {
    const { container } = render(Select, {
      props: { id: 'labeled-select', value: 'a', options: defaultOptions, label: 'Choose one' },
    });
    const labelEl = container.querySelector('label[for="labeled-select"]');
    expect(labelEl).not.toBeNull();
    expect(labelEl!.textContent).toBe('Choose one');
  });

  test('on user change event, bound value updates', async () => {
    const { container } = render(Select, {
      props: { id: 'test-select', value: 'a', options: defaultOptions },
    });
    const selectEl = container.querySelector('select') as HTMLSelectElement;
    await fireEvent.change(selectEl, { target: { value: 'c' } });
    expect(selectEl.value).toBe('c');
  });

  test('empty options: console.warn called with "Select: options is empty" and data-cinder-empty="true" on select', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(Select, {
        props: { id: 'empty-select', value: '', options: [] },
      });
      const selectEl = container.querySelector('select#empty-select');
      expect(selectEl).not.toBeNull();
      expect(selectEl!.getAttribute('data-cinder-empty')).toBe('true');
      expect(warnSpy).toHaveBeenCalledWith('Select: options is empty');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
