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

  test('clear button returns focus to trigger when selections are removed', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['apple'],
    });

    const clearButton = container.querySelector<HTMLButtonElement>('.cinder-multi-select__clear');
    const trigger = container.querySelector<HTMLButtonElement>('#fruits');
    if (!clearButton || !trigger) throw new Error('clear controls not found');

    clearButton.focus();
    await fireEvent.click(clearButton);
    expect(document.activeElement).toBe(trigger);
  });

  test('clear button does not close an open menu', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      selectedIds: ['apple', 'banana'],
    });
    await openMenu(container);

    const clearButton = container.querySelector<HTMLButtonElement>('.cinder-multi-select__clear');
    if (!clearButton) throw new Error('clear button not found');
    await fireEvent.click(clearButton);

    expect(container.querySelector('#fruits-popover')).not.toBeNull();
    expect(container.querySelector('#fruits')?.textContent).toContain('Select options');
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

  test('deduplicates selected ids for hidden inputs and count summary', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      name: 'fruits',
      items,
      selectedIds: ['apple', 'apple', 'banana'],
    });

    const hidden = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="fruits"]'),
    ).map((input) => input.value);

    expect(hidden).toEqual(['apple', 'banana']);
    expect(container.querySelector('#fruits')?.textContent).toContain('2 selected');
  });

  test('ignores orphan selected ids for summary and form serialization', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      name: 'fruits',
      items,
      selectedIds: ['apple', 'missing', 'banana'],
    });

    const hidden = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="fruits"]'),
    ).map((input) => input.value);

    expect(hidden).toEqual(['apple', 'banana']);
    expect(container.querySelector('#fruits')?.textContent).toContain('2 selected');
  });

  test('required validation remains invalid when selected ids are all orphaned', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      name: 'fruits',
      required: true,
      items,
      selectedIds: ['missing'],
    });
    const proxy = container.querySelector<HTMLInputElement>(
      '.cinder-multi-select__validation-proxy',
    );
    if (!proxy) throw new Error('validation proxy not found');

    expect(proxy.checkValidity()).toBe(false);
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

  test('required validation focuses the trigger instead of the hidden proxy', () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      required: true,
      items,
    });

    const proxy = container.querySelector<HTMLInputElement>(
      '.cinder-multi-select__validation-proxy',
    );
    const trigger = container.querySelector<HTMLButtonElement>('#fruits');
    if (!proxy || !trigger) throw new Error('required controls not found');

    expect(proxy.reportValidity()).toBe(false);
    expect(document.activeElement).toBe(trigger);
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

  test('empty list row is exposed as a disabled option', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });

    await openMenu(container);
    const filter = container.querySelector<HTMLInputElement>('.cinder-multi-select__filter');
    if (!filter) throw new Error('filter input not found');
    await fireEvent.input(filter, { target: { value: 'zzz' } });

    const empty = container.querySelector('.cinder-multi-select__empty');
    expect(empty?.getAttribute('role')).toBe('option');
    expect(empty?.getAttribute('aria-disabled')).toBe('true');
  });

  test('filter input has an accessible name and space does not toggle selection', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });

    await openMenu(container);
    const filter = container.querySelector<HTMLInputElement>('.cinder-multi-select__filter');
    if (!filter) throw new Error('filter input not found');

    expect(filter.getAttribute('aria-label')).toBe('Filter options');
    expect(filter.getAttribute('role')).toBe('combobox');
    expect(filter.getAttribute('aria-haspopup')).toBe('listbox');
    await fireEvent.keyDown(filter, { key: ' ' });
    expect(container.querySelector('#fruits-option-0')?.getAttribute('aria-selected')).toBe(
      'false',
    );
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
    expect(listbox.getAttribute('aria-activedescendant')).toBe('fruits-option-0');
    expect(trigger.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('disabled option cannot be selected', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    await openMenu(container);
    const disabledOption = container.querySelector('#fruits-option-3');
    if (!disabledOption) throw new Error('disabled option not found');
    await fireEvent.mouseDown(disabledOption);
    expect(disabledOption.getAttribute('aria-selected')).toBe('false');
  });

  test('disabled option does not become active on hover', async () => {
    const { container } = render(MultiSelect, { id: 'fruits', items });
    await openMenu(container);

    const disabledOption = container.querySelector('#fruits-option-3');
    if (!disabledOption) throw new Error('disabled option not found');
    await fireEvent.mouseEnter(disabledOption);

    expect(disabledOption.getAttribute('data-cinder-active')).toBeNull();
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

  test('listbox is labelled by the component label', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      label: 'Fruits',
      items,
    });

    await openMenu(container);
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.getAttribute('aria-labelledby')).toBe('fruits-label');
  });

  test('open panel is anchored inside control wrapper', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      warning: 'Keep at least one selection.',
      items,
    });

    await openMenu(container);
    const panel = container.querySelector('#fruits-popover');
    expect(panel?.closest('.cinder-multi-select__control')).not.toBeNull();
  });

  test('menu closes when focus moves away with keyboard navigation', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });
    await openMenu(container);

    const outside = document.createElement('button');
    outside.type = 'button';
    document.body.append(outside);
    outside.focus();

    await waitFor(() => {
      expect(container.querySelector('#fruits-popover')).toBeNull();
    });

    const trigger = container.querySelector<HTMLButtonElement>('#fruits');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(outside);
  });

  test('filterable mode keeps active descendant on filter input only', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });
    await openMenu(container);

    const filter = container.querySelector<HTMLInputElement>('.cinder-multi-select__filter');
    const listbox = container.querySelector<HTMLElement>('[role="listbox"]');
    if (!filter || !listbox) throw new Error('filterable controls not found');

    await fireEvent.keyDown(filter, { key: 'ArrowDown' });
    expect(filter.getAttribute('aria-activedescendant')).toBe('fruits-option-1');
    expect(listbox.getAttribute('aria-activedescendant')).toBeNull();
  });

  test('filterable Enter with no active option does not submit parent form', async () => {
    const { container } = render(MultiSelect, {
      id: 'fruits',
      items,
      filterable: true,
    });
    const form = document.createElement('form');
    document.body.append(form);
    form.append(container);

    let submitCount = 0;
    form.addEventListener('submit', (event) => {
      submitCount += 1;
      event.preventDefault();
    });

    await openMenu(form);
    const filter = form.querySelector<HTMLInputElement>('.cinder-multi-select__filter');
    if (!filter) throw new Error('filter input not found');
    await fireEvent.input(filter, { target: { value: 'zzz' } });
    await fireEvent.keyDown(filter, { key: 'Enter' });

    expect(submitCount).toBe(0);
  });
});
