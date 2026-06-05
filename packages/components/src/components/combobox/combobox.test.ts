/// <reference lib="dom" />
import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { stripCinderComponentsLayer } from '../../test/css.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

expect.extend(matchers as Parameters<typeof expect.extend>[0]);

setupHappyDom();

const {
  render: renderIntoContainer,
  fireEvent,
  waitFor,
  cleanup,
} = await import('@testing-library/svelte');
const { default: Combobox } = await import('./combobox.svelte');

// These tests render into the shared `document.body` (see `render` below). The
// listbox opens on focus through Svelte effects, so options are not guaranteed
// to be in the DOM synchronously on the next line after `await fireEvent.focus`
// — under coverage instrumentation and on slower CI runners the effect can land
// a tick later. Without `cleanup()`, torn-down instances also leave pending
// effects and animation microtasks (see the happy-dom animate stub) that race
// the next render. `cleanup()` unmounts between tests; `findOption`/`waitFor`
// de-race the assertions so a one-tick delay no longer reads as an empty list.
// `replaceChildren()` before each test additionally wipes any listbox nodes a
// prior test left appended to `document.body` that `cleanup()` doesn't track,
// so `findOption` can never match a stale option from another test.
beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
];

/** Wait for an open listbox option whose text contains `label`, then return it. */
async function findOption(label: string): Promise<Element> {
  let match: Element | undefined;
  await waitFor(() => {
    match = Array.from(document.body.querySelectorAll('[role="option"]')).find((element) =>
      element.textContent?.includes(label),
    );
    if (!match) throw new Error(`option containing "${label}" not found`);
  });
  // `waitFor` resolves only once the callback stops throwing, so `match` is set.
  return match!;
}

/**
 * Wait until the listbox has settled after an open/filter interaction — i.e.
 * at least one `[role="option"]` is present, or the explicit empty state is.
 * The listbox opens through a Svelte effect, so a synchronous read on the next
 * line after `fireEvent.focus`/`keyDown`/`input` can race the effect and see an
 * empty list; awaiting this first makes the subsequent synchronous queries safe.
 */
async function waitForListbox(): Promise<void> {
  await waitFor(() => {
    const settled =
      document.body.querySelector('[role="option"]') !== null ||
      document.body.querySelector('.cinder-combobox__empty') !== null;
    if (!settled) throw new Error('listbox has not opened');
  });
}

function readComboboxStyles(): string {
  // Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
  // getComputedStyle. Inner declarations are unchanged.
  return stripCinderComponentsLayer(
    readFileSync(new URL('./combobox.css', import.meta.url), 'utf8'),
  );
}

function render(...args: Parameters<typeof renderIntoContainer>) {
  const result = renderIntoContainer(...args);
  return { ...result, container: document.body };
}

describe('Combobox', () => {
  test('select via mousedown closes the listbox and sets the input value', async () => {
    const { container } = render(Combobox, { id: 'editable-fruit', options: fruits });
    const input = container.querySelector('#editable-fruit') as HTMLInputElement;
    await fireEvent.focus(input);

    const option = await findOption('Apricot');
    await fireEvent.mouseDown(option);

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(input.value).toBe('Apricot');
  });

  test('after selection, editing the input filters options and reopens the listbox', async () => {
    const { container } = render(Combobox, { id: 'editable-fruit', options: fruits });
    const input = container.querySelector('#editable-fruit') as HTMLInputElement;
    await fireEvent.focus(input);

    const appleOption = await findOption('Apple');
    await fireEvent.mouseDown(appleOption);

    await fireEvent.input(input, { target: { value: 'ap' } });

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    await waitFor(() => {
      const filteredOptions = Array.from(container.querySelectorAll('[role="option"]'));
      expect(filteredOptions.map((option) => option.textContent?.trim())).toEqual([
        'Apple',
        'Apricot',
      ]);
    });
  });

  test('user can select a different option after the first selection', async () => {
    const { container } = render(Combobox, { id: 'editable-fruit', options: fruits });
    const input = container.querySelector('#editable-fruit') as HTMLInputElement;
    await fireEvent.focus(input);

    const appleOption = await findOption('Apple');
    await fireEvent.mouseDown(appleOption);

    await fireEvent.input(input, { target: { value: 'apri' } });

    const apricotOption = await findOption('Apricot');
    await fireEvent.mouseDown(apricotOption);

    expect(input.value).toBe('Apricot');

    await fireEvent.focus(input);

    await waitFor(() => {
      const selectedOption = container.querySelector('[role="option"][aria-selected="true"]');
      expect(selectedOption?.textContent?.trim()).toBe('Apricot');
    });
  });

  test('typing after selection does not reset the input to the previously-selected label', async () => {
    const { container } = render(Combobox, { id: 'editable-fruit', options: fruits });
    const input = container.querySelector('#editable-fruit') as HTMLInputElement;
    await fireEvent.focus(input);

    const appleOption = await findOption('Apple');
    await fireEvent.mouseDown(appleOption);

    await fireEvent.input(input, { target: { value: 'Apr' } });

    expect(input.value).not.toBe('Apple');
    expect(input.value).toBe('Apr');
  });
});

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
    await waitForListbox();
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.length).toBe(3);
  });

  test('typing filters options by case-insensitive substring', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'an' } });
    await waitFor(() => {
      const options = Array.from(container.querySelectorAll('[role="option"]'));
      expect(options.map((option) => option.textContent?.trim())).toEqual(['Banana']);
    });
  });

  test('typing with no matches renders the empty state', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'zzz' } });
    await waitFor(() => {
      expect(container.querySelector('[role="option"]')).toBeNull();
      expect(container.querySelector('.cinder-combobox__empty')?.textContent?.trim()).toBe(
        'No results',
      );
    });
  });

  test('custom filter callback is honored', async () => {
    const { container } = render(Combobox, {
      id: 'fruit',
      options: fruits,
      filter: (option: { value: string }) => option.value.startsWith('a'),
    });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    await waitFor(() => {
      const options = Array.from(container.querySelectorAll('[role="option"]'));
      expect(options.map((option) => option.textContent?.trim())).toEqual(['Apple', 'Apricot']);
    });
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
    await waitFor(() => {
      const options = Array.from(container.querySelectorAll('[role="option"]'));
      expect(options.length).toBe(50);
    });
  });
});

describe('Combobox keyboard', () => {
  test('ArrowDown opens the listbox and activates the first option', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      const active = container.querySelector('[role="option"][data-cinder-active]');
      expect(active?.textContent?.trim()).toBe('Apple');
      // Set by the same effect as data-cinder-active — assert together so the
      // read can't race ahead of the activedescendant update.
      expect(input.getAttribute('aria-activedescendant')).toBe('fruit-option-0');
    });
  });

  test('ArrowDown wraps from the last option to the first', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    // Open and move to the last index.
    await fireEvent.focus(input);
    await fireEvent.keyDown(input, { key: 'End' });
    await waitFor(() => {
      const active = container.querySelector('[role="option"][data-cinder-active]');
      expect(active?.textContent?.trim()).toBe('Banana');
    });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      const active = container.querySelector('[role="option"][data-cinder-active]');
      expect(active?.textContent?.trim()).toBe('Apple');
    });
  });

  test('Enter selects the active option', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(input.value).toBe('Apricot');
      // Listbox closes in the same selection effect — assert together.
      expect(container.querySelector('[role="listbox"]')).toBeNull();
    });
  });

  test('Escape closes the listbox without selecting', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    input.focus();
    await fireEvent.focus(input);
    await waitFor(() => expect(container.querySelector('[role="listbox"]')).not.toBeNull());
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('Combobox selection', () => {
  test('mousedown on an option selects it', async () => {
    const { container } = render(Combobox, { id: 'fruit', options: fruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const apricot = await findOption('Apricot');
    await fireEvent.mouseDown(apricot);
    expect(input.value).toBe('Apricot');
  });

  test('disabled options are not selectable', async () => {
    const disabledFruits = [
      { value: 'apple', label: 'Apple' },
      { value: 'durian', label: 'Durian', disabled: true },
    ];
    const { container } = render(Combobox, { id: 'fruit', options: disabledFruits });
    const input = container.querySelector(`#fruit`) as HTMLInputElement;
    await fireEvent.focus(input);
    const durian = await findOption('Durian');
    expect(durian.getAttribute('aria-disabled')).toBe('true');
    await fireEvent.mouseDown(durian);
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

  test('inactive error live region is removed from flex layout flow', () => {
    expect(readComboboxStyles()).toContain(
      '.cinder-combobox__error:not([data-cinder-error]) {\n  position: absolute;',
    );
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
    await waitForListbox();
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
    await waitForListbox();
    const option = container.querySelector('[role="option"]');
    expect(option?.querySelector('img')).toBeNull();
  });

  test('option with whitespace-only avatar does not render an <img>', async () => {
    const options = [{ value: 'x', label: 'X', avatar: '   ' }];
    const { container } = render(Combobox, { id: 'rich', options });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await waitForListbox();
    const option = container.querySelector('[role="option"]');
    expect(option?.querySelector('img')).toBeNull();
  });

  test('option with description renders the description text inside the <li>', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await waitForListbox();
    const appleOption = container.querySelector('[role="option"]');
    const desc = appleOption?.querySelector('.cinder-combobox__option-description');
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toBe('A crisp red fruit');
  });

  test('option with description carries aria-label composed from label and description', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await waitForListbox();
    const options = container.querySelectorAll('[role="option"]');
    const appleOption = options[0];
    expect(appleOption?.getAttribute('aria-label')).toBe('Apple, A crisp red fruit');
  });

  test('plain option (no description) has no aria-label', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await waitForListbox();
    const options = container.querySelectorAll('[role="option"]');
    const cherryOption = options[2];
    expect(cherryOption?.hasAttribute('aria-label')).toBe(false);
  });

  test('plain option renders only label, no avatar or description nodes', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await waitForListbox();
    const options = container.querySelectorAll('[role="option"]');
    const cherryOption = options[2];
    expect(cherryOption?.querySelector('img')).toBeNull();
    expect(cherryOption?.querySelector('.cinder-combobox__option-description')).toBeNull();
  });

  test('selecting a rich option sets value and inputValue from value/label only', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    const appleOption = await findOption('Apple');
    await fireEvent.mouseDown(appleOption);
    // input.value reflects the label (display text)
    expect(input.value).toBe('Apple');
    // Re-open to check aria-selected reflects the internal value binding (option.value)
    await fireEvent.focus(input);
    await waitFor(() => {
      const selectedOption = container.querySelector('[role="option"][aria-selected="true"]');
      expect(selectedOption?.querySelector('.cinder-combobox__option-label')?.textContent).toBe(
        'Apple',
      );
    });
  });

  test('default filter matches description substring (case-insensitive)', async () => {
    const { container } = render(Combobox, { id: 'rich', options: richFruits });
    const input = container.querySelector('#rich') as HTMLInputElement;
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'curved' } });
    await waitFor(() => {
      const options = container.querySelectorAll('[role="option"]');
      expect(options.length).toBe(1);
      expect(options[0]?.querySelector('.cinder-combobox__option-label')?.textContent).toBe(
        'Banana',
      );
    });
  });
});
