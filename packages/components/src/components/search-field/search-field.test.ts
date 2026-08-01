/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { SearchFieldProps } from './search-field.types.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: SearchField } = await import('./search-field.svelte');
const { default: FormFieldSearchFieldFixture } =
  await import('../../test/fixtures/form-field-search-field-fixture.svelte');

describe('SearchField rendering', () => {
  test('sidecar imports the composed Input styles', () => {
    const styles = readFileSync(new URL('./search-field.css', import.meta.url), 'utf8');
    expect(styles).toContain("@import '../input/input.css';");
  });

  test('type surface excludes inherited defaultValue', () => {
    const excludesInheritedDefaultValue: 'defaultValue' extends keyof SearchFieldProps
      ? false
      : true = true;

    expect(excludesInheritedDefaultValue).toBe(true);
  });

  test('renders an input with type="search"', () => {
    const { container } = render(SearchField, { props: { id: 'search' } });
    const input = container.querySelector('#search') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('type')).toBe('search');
  });

  test('composes the shared Input control and grouped adornments', () => {
    const { container } = render(SearchField, { props: { id: 'search', value: 'cinder' } });
    expect(container.querySelector('.cinder-input-field')).not.toBeNull();
    expect(container.querySelector('.cinder-input-group')).not.toBeNull();
    expect(container.querySelector('#search')?.classList.contains('cinder-input')).toBe(true);
  });

  test('forwards accessible input attributes while preserving the search role', () => {
    const { getByRole } = render(SearchField, {
      props: {
        id: 'search',
        'aria-label': 'Search components',
        value: 'cinder',
      },
    });

    const input = getByRole('searchbox', { name: 'Search components' });
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).value).toBe('cinder');
    expect((input as HTMLInputElement).type).toBe('search');
  });

  test('renders the leading search icon as aria-hidden', () => {
    const { container } = render(SearchField, { props: { id: 'search' } });
    const leading = container.querySelector('.cinder-search-field__leading');
    expect(leading).not.toBeNull();
    expect(leading?.getAttribute('aria-hidden')).toBe('true');
  });

  test('does NOT set role="searchbox" (redundant on type="search")', () => {
    const { container } = render(SearchField, { props: { id: 'search' } });
    const input = container.querySelector('#search');
    expect(input?.getAttribute('role')).toBeNull();
  });

  test('renders the placeholder', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', placeholder: 'Search…' },
    });
    const input = container.querySelector('#search');
    expect(input?.getAttribute('placeholder')).toBe('Search…');
  });

  test('forwards the name attribute', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', name: 'q' },
    });
    expect(container.querySelector('#search')?.getAttribute('name')).toBe('q');
  });

  test('applies class prop alongside cinder-search-field', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', class: 'my-search' },
    });
    const root = container.querySelector('.cinder-search-field');
    expect(root?.classList.contains('my-search')).toBe(true);
  });

  test('forwards native style props to the shared input control', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', style: 'letter-spacing: 0.05em;' },
    });
    expect(container.querySelector('#search')?.getAttribute('style')).toBe(
      'letter-spacing: 0.05em;',
    );
  });
});

describe('SearchField clear button', () => {
  test('clear button is hidden when value is empty', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: '' },
    });
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    expect(clear.hasAttribute('hidden')).toBe(true);
  });

  test('clear button is visible when value is non-empty', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello' },
    });
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(clear.hasAttribute('hidden')).toBe(false);
  });

  test('clear button has aria-label="Clear search"', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'x' },
    });
    const clear = container.querySelector('.cinder-search-field__clear');
    expect(clear?.getAttribute('aria-label')).toBe('Clear search');
  });

  test('clear button has type="button" so it does not submit forms', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'x' },
    });
    const clear = container.querySelector('.cinder-search-field__clear');
    expect(clear?.getAttribute('type')).toBe('button');
  });

  test('clear button is excluded from tab order when empty (tabindex=-1)', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: '' },
    });
    const clear = container.querySelector('.cinder-search-field__clear');
    expect(clear?.getAttribute('tabindex')).toBe('-1');
  });

  test('clear button is in tab order when value is non-empty (tabindex=0)', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'x' },
    });
    const clear = container.querySelector('.cinder-search-field__clear');
    expect(clear?.getAttribute('tabindex')).toBe('0');
  });

  test('clear click fires onClear and sets value to empty string via oninput', async () => {
    const oninput = mock((_value: string) => {});
    const onClear = mock(() => {});
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello', oninput, onClear },
    });
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    await fireEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(oninput).toHaveBeenCalledWith('');
  });

  test('clear returns focus to the input', async () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello' },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    await fireEvent.click(clear);
    expect(document.activeElement).toBe(input);
  });

  test('uncontrolled: clear empties the input value', async () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello' },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    await fireEvent.click(clear);
    expect(input.value).toBe('');
  });
});

describe('SearchField shortcut hint', () => {
  test('no <kbd> badge when shortcut prop is absent', () => {
    const { container } = render(SearchField, { props: { id: 'search' } });
    expect(container.querySelector('.cinder-search-field__shortcut')).toBeNull();
  });

  test('renders <kbd> badge with shortcut text when provided', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', shortcut: '⌘K' },
    });
    const badge = container.querySelector('.cinder-search-field__shortcut');
    expect(badge).not.toBeNull();
    expect(badge?.tagName.toLowerCase()).toBe('kbd');
    expect(badge?.textContent).toBe('⌘K');
  });

  test('shortcut badge is aria-hidden so screen readers do not announce it', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', shortcut: '⌘K' },
    });
    const badge = container.querySelector('.cinder-search-field__shortcut');
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SearchField input callbacks', () => {
  test('oninput fires on every keystroke with the current value', async () => {
    const oninput = mock((_value: string) => {});
    const { container } = render(SearchField, {
      props: { id: 'search', oninput },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'a' } });
    await fireEvent.input(input, { target: { value: 'ab' } });
    expect(oninput).toHaveBeenCalledTimes(2);
    expect(oninput).toHaveBeenNthCalledWith(1, 'a');
    expect(oninput).toHaveBeenNthCalledWith(2, 'ab');
  });

  test('onsearch fires once on the native search event (Enter dispatches it in real browsers)', async () => {
    const onsearch = mock((_value: string) => {});
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'query', onsearch },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    await fireEvent(input, new Event('search', { bubbles: true }));
    expect(onsearch).toHaveBeenCalledTimes(1);
    expect(onsearch).toHaveBeenCalledWith('query');
  });

  test('consumer onkeydown handler is composed, not dropped', async () => {
    const consumerKeyDown = mock((_event: KeyboardEvent) => {});
    const { container } = render(SearchField, {
      props: { id: 'search', value: '', onkeydown: consumerKeyDown },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(consumerKeyDown).toHaveBeenCalledTimes(1);
  });

  test('disabled: input has the disabled attribute (browsers suppress events natively)', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', disabled: true, oninput: () => {} },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  test('uncontrolled: clearing also updates the reactive hasValue (clear button becomes hidden)', async () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello' },
    });
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(clear.hasAttribute('hidden')).toBe(false);
    await fireEvent.click(clear);
    expect(clear.hasAttribute('hidden')).toBe(true);
  });

  test('bindable clear mutates the input DOM value', async () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello', oninput: () => {} },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    await fireEvent.click(clear);
    expect(input.value).toBe('');
  });

  test('readonly: clear button is disabled and does not mutate the value', async () => {
    const onClear = mock(() => {});
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hello', readonly: true, onClear },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    await fireEvent.click(clear);
    expect(input.value).toBe('hello');
    expect(onClear).not.toHaveBeenCalled();
  });

  test('uncontrolled: typing updates the displayed input value', async () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: '' },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'hello' } });
    expect(input.value).toBe('hello');
  });
});

describe('SearchField context inheritance from FormField', () => {
  test('inherits aria-describedby pointing to the FormField description', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: { fieldId: 'ctx-search', fieldLabel: 'Site search', fieldDescription: 'Helper' },
    });
    const input = container.querySelector('#ctx-search');
    expect(input?.getAttribute('aria-describedby')).toBe('ctx-search-description');
  });

  test('inherits aria-invalid="true" from FormField error', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: { fieldId: 'ctx-search', fieldLabel: 'Site search', fieldError: 'Required' },
    });
    const input = container.querySelector('#ctx-search');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  test('FormField error sets data-invalid on the wrapper', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: { fieldId: 'ctx-search', fieldLabel: 'Site search', fieldError: 'Required' },
    });
    const root = container.querySelector('.cinder-search-field');
    expect(root?.hasAttribute('data-invalid')).toBe(true);
  });

  test('inherits required from FormField context', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: { fieldId: 'ctx-search', fieldLabel: 'Site search', fieldRequired: true },
    });
    const input = container.querySelector('#ctx-search') as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  test('consumer required={true} wins over FormField context required={false}', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: {
        fieldId: 'ctx-search',
        fieldLabel: 'Site search',
        fieldRequired: false,
        searchFieldRequired: true,
      },
    });
    const input = container.querySelector('#ctx-search') as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  test('inherits disabled from FormField context (input + clear button)', () => {
    const { container } = render(FormFieldSearchFieldFixture, {
      props: { fieldId: 'ctx-search', fieldLabel: 'Site search', fieldDisabled: true },
    });
    const input = container.querySelector('#ctx-search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(clear.disabled).toBe(true);
  });
});

describe('SearchField disabled state', () => {
  test('disabled forwards to the input and clear button', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', value: 'hi', disabled: true },
    });
    const input = container.querySelector('#search') as HTMLInputElement;
    const clear = container.querySelector('.cinder-search-field__clear') as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(clear.disabled).toBe(true);
  });

  test('disabled sets data-disabled on the root', () => {
    const { container } = render(SearchField, {
      props: { id: 'search', disabled: true },
    });
    const root = container.querySelector('.cinder-search-field');
    expect(root?.hasAttribute('data-disabled')).toBe(true);
  });
});

describe('SearchField form reset behavior', () => {
  test('disabled search fields reset with their form', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const { rerender } = render(SearchField, {
      target: form,
      props: { id: 'search', name: 'query', value: 'initial' },
    });
    const input = form.querySelector('#search');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected SearchField to render a search input.');
    }

    await fireEvent.input(input, { target: { value: 'changed' } });
    await rerender({ id: 'search', name: 'query', value: 'changed', disabled: true });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(input.disabled).toBe(true);
    expect(input.value).toBe('initial');
  });

  test('canceled form reset leaves the current search value unchanged', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    render(SearchField, {
      target: form,
      props: { id: 'search', name: 'query', value: 'initial' },
    });
    const input = form.querySelector('#search');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected SearchField to render a search input.');
    }

    await fireEvent.input(input, { target: { value: 'changed' } });
    const valueBeforeReset = input.value;
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true });

    form.dispatchEvent(new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(input.value).toBe(valueBeforeReset);
  });
});
