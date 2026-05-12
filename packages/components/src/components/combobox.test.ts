/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Combobox } = await import('./combobox.svelte');

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'durian', label: 'Durian', disabled: true },
];

describe('Combobox structure', () => {
  test('renders an input with role=combobox and aria-controls', () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`);
    expect(input?.getAttribute('role')).toBe('combobox');
    expect(input?.getAttribute('aria-autocomplete')).toBe('list');
    expect(input?.getAttribute('aria-controls')).toBe('fruit-listbox');
  });

  test('renders a label when label prop is supplied', () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      label: 'Fruit',
    });
    const label = container.querySelector('label');
    expect(label?.getAttribute('for')).toBe('fruit');
    expect(label?.textContent?.trim()).toBe('Fruit');
  });

  test('listbox is closed by default and has no aria-expanded=true', () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    expect(container.querySelector(`#fruit`)?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('Combobox filtering', () => {
  test('opens on focus and shows all options', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(4);
  });

  test('typing filters options by case-insensitive substring', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'an' } });
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    // Banana, Durian (durian contains 'an' if we're doing simple includes — but 'an' isn't in 'Durian'). Actually 'd-u-r-i-a-n' contains 'an' (positions 4-5). Yes.
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Banana', 'Durian']);
  });

  test('typing with no matches renders the empty state', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'zzz' } });
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(container.querySelector('.cinder-combobox__empty')?.textContent?.trim()).toBe(
      'No results',
    );
  });

  test('custom filter callback is honored', async () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      filter: (option: { value: string }) => option.value.startsWith('a'),
    });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Apple']);
  });

  test('maxVisibleOptions caps the rendered list', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ value: String(i), label: `Item ${i}` }));
    const { container } = render(Combobox, {
      id: 'big',
      options: many,
      maxVisibleOptions: 50,
    });
    const input = container.querySelector('#big') as HTMLInputElement;
    await fireEvent.focus(input);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(50);
  });
});

describe('Combobox keyboard', () => {
  test('ArrowDown opens the listbox and activates the first option', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    const active = container.querySelector('[role="option"][data-cinder-active]');
    expect(active?.textContent?.trim()).toBe('Apple');
    expect(input.getAttribute('aria-activedescendant')).toBe('fruit-option-0');
  });

  test('ArrowDown wraps from the last option to the first', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    // Open and move to the last index.
    await fireEvent.focus(input);
    await fireEvent.keyDown(input, { key: 'End' });
    let active = container.querySelector('[role="option"][data-cinder-active]');
    expect(active?.textContent?.trim()).toBe('Durian');
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    active = container.querySelector('[role="option"][data-cinder-active]');
    expect(active?.textContent?.trim()).toBe('Apple');
  });

  test('Enter selects the active option', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('Banana');
    // Listbox closes after selection.
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  test('Escape closes the listbox without selecting', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.focus(input);
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('Combobox selection', () => {
  test('mousedown on an option selects it', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const cherry = Array.from(container.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.includes('Cherry'),
    );
    expect(cherry).toBeDefined();
    await fireEvent.mouseDown(cherry as Element);
    expect(input.value).toBe('Cherry');
  });

  test('disabled options are not selectable', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const durian = Array.from(container.querySelectorAll('[role="option"]')).find((el) =>
      el.textContent?.includes('Durian'),
    );
    expect(durian?.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.mouseDown(durian as Element);
    expect(input.value).toBe('');
  });
});

describe('Combobox aria wiring', () => {
  test('error sets aria-invalid="true" and renders an aria-live="polite" error region', () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      error: 'Pick one',
    });
    const input = container.querySelector(`#fruit`);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('fruit-error');
    const errEl = container.querySelector('#fruit-error');
    expect(errEl?.textContent?.trim()).toBe('Pick one');
    expect(errEl?.getAttribute('aria-live')).toBe('polite');
  });

  test('description appears in aria-describedby', () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      description: 'Type to filter',
    });
    const input = container.querySelector(`#fruit`);
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('fruit-description');
  });

  test('consumer-supplied aria-describedby is composed with component-generated ids', () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      description: 'Type to filter',
      'aria-describedby': 'external-tooltip',
    });
    const input = container.querySelector('#fruit');
    const describedBy = input?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('fruit-description');
    expect(describedBy).toContain('external-tooltip');
    expect(describedBy.indexOf('fruit-description')).toBeLessThan(
      describedBy.indexOf('external-tooltip'),
    );
  });

  test('consumer-supplied aria-describedby alone (no description prop) is forwarded', () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      'aria-describedby': 'external-hint',
    });
    const input = container.querySelector('#fruit');
    expect(input?.getAttribute('aria-describedby')).toBe('external-hint');
  });
});

describe('Combobox rich option rows', () => {
  const richFruits = [
    {
      value: 'apple',
      label: 'Apple',
      description: 'A crisp red fruit',
      avatar: 'https://example.com/apple.png',
    },
    { value: 'banana', label: 'Banana', description: 'A yellow curved fruit' },
    { value: 'cherry', label: 'Cherry' },
  ];

  test('option with avatar renders an <img> with empty alt', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const appleOption = container.querySelector('[role="option"]');
    const img = appleOption?.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('');
    expect(img!.getAttribute('src')).toBe('https://example.com/apple.png');
  });

  test('option with empty-string avatar does not render an <img>', async () => {
    const options = [{ value: 'x', label: 'X', avatar: '' }];
    const { container } = render(Combobox, { id: 'rich', options });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const option = container.querySelector('[role="option"]');
    expect(option?.querySelector('img')).toBeNull();
  });

  test('option with whitespace-only avatar does not render an <img>', async () => {
    const options = [{ value: 'x', label: 'X', avatar: '   ' }];
    const { container } = render(Combobox, { id: 'rich', options });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const option = container.querySelector('[role="option"]');
    expect(option?.querySelector('img')).toBeNull();
  });

  test('option with description renders the description text inside the <li>', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const appleOption = container.querySelector('[role="option"]');
    const desc = appleOption?.querySelector('.cinder-combobox__option-description');
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toBe('A crisp red fruit');
  });

  test('option with description carries aria-label composed from label and description', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const options = container.querySelectorAll('[role="option"]');
    const appleOption = options[0];
    expect(appleOption?.getAttribute('aria-label')).toBe('Apple, A crisp red fruit');
  });

  test('plain option (no description) has no aria-label', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const options = container.querySelectorAll('[role="option"]');
    const cherryOption = options[2];
    expect(cherryOption?.hasAttribute('aria-label')).toBe(false);
  });

  test('plain option renders only label, no avatar or description nodes', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const options = container.querySelectorAll('[role="option"]');
    const cherryOption = options[2];
    expect(cherryOption?.querySelector('img')).toBeNull();
    expect(cherryOption?.querySelector('.cinder-combobox__option-description')).toBeNull();
  });

  test('selecting a rich option sets value and inputValue from value/label only', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const appleOption = container.querySelector('[role="option"]') as Element;
    await fireEvent.mouseDown(appleOption);
    // input.value reflects the label (display text)
    expect(input.value).toBe('Apple');
    // Re-open to check aria-selected reflects the internal value binding (option.value)
    await fireEvent.focus(input);
    const selectedOption = container.querySelector('[role="option"][aria-selected="true"]');
    expect(selectedOption?.querySelector('.cinder-combobox__option-label')?.textContent).toBe(
      'Apple',
    );
  });

  test('default filter matches description substring (case-insensitive)', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'curved' } });
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0]?.querySelector('.cinder-combobox__option-label')?.textContent).toBe('Banana');
  });
});
