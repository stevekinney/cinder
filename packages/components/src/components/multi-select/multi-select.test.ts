/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);
setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: MultiSelect } = await import('./multi-select.svelte');

const items = [
  { id: 'apple', label: 'Apple' },
  { id: 'apricot', label: 'Apricot' },
  { id: 'banana', label: 'Banana' },
  { id: 'dragonfruit', label: 'Dragonfruit', disabled: true },
] as const;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => cleanup());

async function openMenu(container: HTMLElement): Promise<void> {
  const trigger = container.querySelector<HTMLButtonElement>('#fruits');
  if (!trigger) throw new Error('trigger not found');
  await fireEvent.click(trigger);
  await waitFor(() => {
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
  });
}

describe('MultiSelect', () => {
  test('renders trigger, placeholder, and listbox semantics', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    expect(container.querySelector('#fruits')?.textContent).toContain('Select options');
    await openMenu(container);
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-multiselectable')).toBe('true');
    expect(container.querySelectorAll('[role="option"]').length).toBe(4);
  });

  test('clicking an option toggles selection and updates count summary', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    await openMenu(container);

    const apple = container.querySelector('#fruits-option-0');
    if (!apple) throw new Error('apple option not found');
    await fireEvent.mouseDown(apple);

    const trigger = container.querySelector('#fruits');
    expect(trigger?.textContent).toContain('1 selected');
    expect(container.querySelector('.cinder-multi-select__count')?.textContent?.trim()).toBe('1');
    expect(apple.getAttribute('aria-selected')).toBe('true');
  });

  test('clear button removes all selected items', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['apple', 'banana'],
    });

    const clearButton = container.querySelector<HTMLButtonElement>('.cinder-multi-select__clear');
    expect(clearButton).not.toBeNull();
    await fireEvent.click(clearButton!);
    expect(container.querySelector('#fruits')?.textContent).toContain('Select options');
    expect(container.querySelector('.cinder-multi-select__count')).toBeNull();
  });

  test('renders one hidden input per selected id when name is set', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      name: 'fruits',
      items,
      selectedIds: ['apple', 'banana'],
    });

    const hidden = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="fruits"]'),
    ).map((input) => input.value);

    expect(hidden).toEqual(['apple', 'banana']);
  });

  test('required validation proxy is invalid when empty and valid when selected', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      name: 'fruits',
      required: true,
      items,
    });
    const proxy = container.querySelector<HTMLInputElement>(
      '.cinder-multi-select__validation-proxy',
    );
    if (!proxy) throw new Error('validation proxy not found');

    expect(proxy.checkValidity()).toBe(false);
    await openMenu(container);
    const apple = container.querySelector('#fruits-option-0');
    if (!apple) throw new Error('apple option not found');
    await fireEvent.mouseDown(apple);
    expect(proxy.checkValidity()).toBe(true);
  });

  test('filterable mode filters options by label', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });

    await openMenu(container);
    const filter = container.querySelector<HTMLInputElement>('.cinder-multi-select__filter');
    if (!filter) throw new Error('filter input not found');
    await fireEvent.input(filter, { target: { value: 'ap' } });

    await waitFor(() => {
      const labels = Array.from(
        container.querySelectorAll('.cinder-multi-select__option-label'),
      ).map((node) => node.textContent?.trim());
      expect(labels).toEqual(['Apple', 'Apricot']);
    });
  });

  test('selectionFeedback="top" keeps selected options first', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['banana'],
      selectionFeedback: 'top',
    });

    await openMenu(container);
    const firstLabel = container
      .querySelector('.cinder-multi-select__option-label')
      ?.textContent?.trim();
    expect(firstLabel).toBe('Banana');
  });

  test('selectionFeedback="top-after-reopen" applies ordering from second open onward', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['banana'],
      selectionFeedback: 'top-after-reopen',
    });

    await openMenu(container);
    const firstOpenFirstLabel = container
      .querySelector('.cinder-multi-select__option-label')
      ?.textContent?.trim();
    expect(firstOpenFirstLabel).toBe('Apple');

    const trigger = container.querySelector<HTMLButtonElement>('#fruits');
    if (!trigger) throw new Error('trigger not found');
    await fireEvent.click(trigger);
    await fireEvent.click(trigger);
    await waitFor(() => {
      const firstLabel = container
        .querySelector('.cinder-multi-select__option-label')
        ?.textContent?.trim();
      expect(firstLabel).toBe('Banana');
    });
  });

  test('readonly prevents selection changes', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['apple'],
      readonly: true,
    });

    await openMenu(container);
    const banana = container.querySelector('#fruits-option-2');
    if (!banana) throw new Error('banana option not found');
    await fireEvent.mouseDown(banana);

    expect(container.querySelector('#fruits')?.textContent).toContain('1 selected');
    expect(banana.getAttribute('aria-selected')).toBe('false');
  });

  test('keyboard navigation toggles active option with Space', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    const trigger = container.querySelector<HTMLButtonElement>('#fruits');
    if (!trigger) throw new Error('trigger not found');

    trigger.focus();
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await waitFor(() => expect(container.querySelector('[role="listbox"]')).not.toBeNull());

    const listbox = container.querySelector('[role="listbox"]');
    if (!listbox) throw new Error('listbox not found');
    await fireEvent.keyDown(listbox, { key: ' ' });
    expect(container.querySelector('#fruits-option-0')?.getAttribute('aria-selected')).toBe('true');
  });

  test('disabled option cannot be selected', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    await openMenu(container);
    const disabledOption = container.querySelector('#fruits-option-3');
    if (!disabledOption) throw new Error('disabled option not found');
    await fireEvent.mouseDown(disabledOption);
    expect(disabledOption.getAttribute('aria-selected')).toBe('false');
  });

  test('warning text participates in aria-describedby', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      warning: 'Choose at least one seasonal item.',
    });
    const trigger = container.querySelector('#fruits');
    expect(trigger?.getAttribute('aria-describedby')).toContain('fruits-warning');
    expect(container.querySelector('#fruits-warning')?.textContent).toContain('seasonal');
  });
});
