/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: Autocomplete } = await import('./autocomplete.svelte');
const { default: FormFieldAutocompleteFixture } =
  await import('../../test/fixtures/form-field-autocomplete-fixture.svelte');

type Suggestion = {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
};

function deferred<T>() {
  let deferredResolve!: (value: T) => void;
  let deferredReject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    deferredResolve = resolve;
    deferredReject = reject;
  });
  return { promise, resolve: deferredResolve, reject: deferredReject };
}

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input') as HTMLInputElement;
}

function getListbox(): HTMLElement | null {
  return document.body.querySelector('[role="listbox"]');
}

function getOptions(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll('[role="option"]'));
}

const fruits: Suggestion[] = [
  { value: 'apple', label: 'Apple', description: 'Keeps the doctor away' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana', disabled: true },
];

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  cleanup();
});

describe('Autocomplete — rendering and ARIA', () => {
  test('renders a combobox input with autocomplete=list semantics', () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => fruits,
      },
    });
    const input = getInput(container);
    expect(input.getAttribute('id')).toBe('fruit-search');
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  test('consumer autocomplete attribute wins over the default off value', () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'search',
        autocomplete: 'street-address',
        suggestionSource: () => [],
      },
    });

    expect(getInput(container).getAttribute('autocomplete')).toBe('street-address');
  });
});

describe('Autocomplete — suggestions and free-form input', () => {
  test('typing updates the input value, calls oninput, and opens suggestions', async () => {
    const oninput = mock((_value: string) => {});
    const suggestionSource = mock((query: string) =>
      fruits.filter((suggestion) => suggestion.value.startsWith(query)),
    );

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource,
        oninput,
      },
    });

    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'ap' } });

    expect(input.value).toBe('ap');
    expect(oninput).toHaveBeenCalledWith('ap');
    expect(suggestionSource).toHaveBeenCalledTimes(1);
    expect(suggestionSource.mock.calls[0]?.[0]).toBe('ap');

    await waitFor(() => {
      expect(getListbox()).not.toBeNull();
      expect(getOptions()).toHaveLength(2);
    });

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('fruit-search-listbox');
  });

  test('highlight wraps the first case-insensitive substring match in mark and preserves casing', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => [{ value: 'grape', label: 'Grape Fruit' }],
      },
    });

    await fireEvent.input(getInput(container), { target: { value: 'fr' } });

    await waitFor(() => {
      const mark = document.body.querySelector('mark');
      expect(mark?.textContent).toBe('Fr');
    });
  });

  test('match highlight uses the theme-aware warning surface tokens, not a hard-coded light value', async () => {
    // Regression: the highlight previously hard-coded a near-white background
    // (`oklch(from var(--cinder-warning) 96.5% …)`) in BOTH themes with
    // `color: inherit`, so in dark mode the matched glyph became a white-on-white
    // box and the letter disappeared. The fix uses the `--cinder-color-warning-bg`
    // / `--cinder-color-warning-fg` light-dark() pair, which contrasts in either
    // theme. happy-dom does not apply stylesheets, so assert against the CSS source.
    const css = await Bun.file(new URL('./autocomplete.css', import.meta.url)).text();
    const matchRule = css.slice(css.indexOf('.cinder-autocomplete__match'));
    const ruleBody = matchRule.slice(0, matchRule.indexOf('}'));
    expect(ruleBody).toContain('var(--cinder-color-warning-bg)');
    expect(ruleBody).toContain('var(--cinder-color-warning-fg)');
    // The broken hard-coded near-white background must be gone.
    expect(ruleBody).not.toMatch(/oklch\(from var\(--cinder-warning\)\s*9[0-9]/);
    // color: inherit was the second half of the bug (light text on light bg).
    expect(ruleBody).not.toMatch(/color:\s*inherit/);
  });

  test('eligible empty results keep the popup open with the empty row', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => [],
      },
    });

    await fireEvent.input(getInput(container), { target: { value: 'zzz' } });

    await waitFor(() => {
      expect(getListbox()).not.toBeNull();
      expect(document.body.textContent).toContain('No suggestions');
    });

    const emptyOption = getOptions()[0];
    expect(emptyOption?.textContent).toContain('No suggestions');
    expect(emptyOption?.getAttribute('aria-disabled')).toBe('true');
  });

  test('normalizes minQueryLength and maxVisibleSuggestions to non-negative integers', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        minQueryLength: -2.4,
        maxVisibleSuggestions: 1.9,
        suggestionSource: () => fruits,
      },
    });

    await fireEvent.input(getInput(container), { target: { value: 'a' } });

    await waitFor(() => {
      expect(getOptions()).toHaveLength(1);
    });

    expect(getInput(container).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Autocomplete — keyboard completion', () => {
  test('Arrow keys skip disabled suggestions and Enter completes the active enabled suggestion once', async () => {
    const oninput = mock((_value: string) => {});
    const oncomplete = mock((_suggestion: Suggestion) => {});

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => fruits,
        oninput,
        oncomplete,
      },
    });

    const input = getInput(container);
    const nativeInputListener = mock((_event: Event) => {});
    input.addEventListener('input', nativeInputListener);

    await fireEvent.input(input, { target: { value: 'a' } });
    await waitFor(() => {
      expect(getOptions()).toHaveLength(3);
    });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input.getAttribute('aria-activedescendant')).toBe('fruit-search-option-1');

    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('apricot');
    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect(oncomplete.mock.calls[0]?.[0]).toEqual({ value: 'apricot', label: 'Apricot' });
    expect(oninput).toHaveBeenCalledTimes(2);
    expect(oninput).toHaveBeenNthCalledWith(1, 'a');
    expect(oninput).toHaveBeenNthCalledWith(2, 'apricot');
    expect(nativeInputListener).toHaveBeenCalledTimes(2);
    expect(getListbox()).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  test('Escape closes the popup without changing the free-form value', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => fruits,
      },
    });

    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'ap' } });
    await waitFor(() => expect(getListbox()).not.toBeNull());

    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(input.value).toBe('ap');
    expect(getListbox()).toBeNull();
  });

  test('completing a suggestion clears stale suggestions before the next ArrowDown', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => fruits,
      },
    });

    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'a' } });
    await waitFor(() => {
      expect(getOptions()).toHaveLength(3);
    });

    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('apricot');
    expect(getListbox()).toBeNull();

    const arrowDownDefaultAllowed = await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(arrowDownDefaultAllowed).toBe(true);
    expect(getListbox()).toBeNull();
    expect(document.body.textContent).not.toContain('Apple');
  });
});

describe('Autocomplete — async source handling', () => {
  test('aborts stale requests, ignores stale resolutions, and shows loading while pending', async () => {
    const first = deferred<Suggestion[]>();
    const second = deferred<Suggestion[]>();
    const signals: AbortSignal[] = [];
    const suggestionSource = mock((query: string, context: { signal: AbortSignal }) => {
      signals.push(context.signal);
      return query === 'a' ? first.promise : second.promise;
    });

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource,
      },
    });

    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'a' } });

    await waitFor(() => {
      expect(getListbox()).not.toBeNull();
      expect(document.body.textContent).toContain('Loading suggestions');
    });

    const loadingOption = getOptions()[0];
    expect(loadingOption?.textContent).toContain('Loading suggestions');
    expect(loadingOption?.getAttribute('aria-disabled')).toBe('true');

    await fireEvent.input(input, { target: { value: 'ap' } });

    expect(signals[0]?.aborted).toBe(true);
    second.resolve([{ value: 'apple', label: 'Apple' }]);
    first.resolve([{ value: 'avocado', label: 'Avocado' }]);

    await waitFor(() => {
      const options = getOptions();
      expect(options).toHaveLength(1);
      expect(options[0]?.textContent).toContain('Apple');
    });

    expect(document.body.textContent).not.toContain('Avocado');
    expect(suggestionSource).toHaveBeenCalledTimes(2);
  });

  test('blur aborts the in-flight request so resolved suggestions do not reopen the popup', async () => {
    const pending = deferred<Suggestion[]>();
    const signals: AbortSignal[] = [];
    const suggestionSource = mock((_query: string, context: { signal: AbortSignal }) => {
      signals.push(context.signal);
      return pending.promise;
    });

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource,
      },
    });

    const input = getInput(container);
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'ap' } });

    await waitFor(() => {
      expect(getListbox()).not.toBeNull();
      expect(document.body.textContent).toContain('Loading suggestions');
    });

    await fireEvent.blur(input);

    expect(signals[0]?.aborted).toBe(true);
    pending.resolve([{ value: 'apple', label: 'Apple' }]);
    await tick();

    expect(getListbox()).toBeNull();
    expect(document.body.textContent).not.toContain('Loading suggestions');
    expect(document.body.textContent).not.toContain('Apple');
  });

  test('source rejection closes the popup and clears stale suggestions', async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    const suggestionSource = mock(async () => {
      throw new Error('boom');
    });

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource,
      },
    });

    await fireEvent.input(getInput(container), { target: { value: 'ap' } });
    await tick();

    await waitFor(() => {
      expect(getListbox()).toBeNull();
    });

    expect(warnings.some((warning) => warning.includes('[cinder/autocomplete]'))).toBe(true);
    console.warn = originalWarn;
  });

  test('synchronous source failures close the popup and clear loading state', async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    const suggestionSource = mock(() => {
      throw new Error('boom');
    });

    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource,
      },
    });

    await fireEvent.input(getInput(container), { target: { value: 'ap' } });
    await tick();

    await waitFor(() => {
      expect(getListbox()).toBeNull();
      expect(document.body.textContent).not.toContain('Loading suggestions');
    });

    expect(warnings.some((warning) => warning.includes('[cinder/autocomplete]'))).toBe(true);
    console.warn = originalWarn;
  });

  test('parent value updates fetch suggestions after Escape closes the focused popup', async () => {
    const suggestionSource = mock((query: string) =>
      fruits.filter((suggestion) => suggestion.value.startsWith(query)),
    );

    const rendered = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        value: 'ap',
        suggestionSource,
      },
    });

    const input = getInput(rendered.container);
    await fireEvent.focus(input);
    await waitFor(() => {
      expect(getListbox()).not.toBeNull();
    });

    await fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(getListbox()).toBeNull();
    });

    await rendered.rerender({
      id: 'fruit-search',
      value: 'ba',
      suggestionSource,
    });

    await waitFor(() => {
      expect(suggestionSource).toHaveBeenLastCalledWith('ba', expect.any(Object));
      expect(getListbox()).not.toBeNull();
    });
  });

  test('Home and End preserve default caret behavior when the popup is closed', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => fruits,
      },
    });

    const input = getInput(container);
    const homeDefaultAllowed = await fireEvent.keyDown(input, { key: 'Home' });
    const endDefaultAllowed = await fireEvent.keyDown(input, { key: 'End' });

    expect(homeDefaultAllowed).toBe(true);
    expect(endDefaultAllowed).toBe(true);
  });

  test('ArrowUp and ArrowDown preserve default behavior when no enabled suggestions are available', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'fruit-search',
        suggestionSource: () => [{ value: 'banana', label: 'Banana', disabled: true }],
      },
    });

    const input = getInput(container);
    await fireEvent.input(input, { target: { value: 'b' } });
    await waitFor(() => {
      expect(getOptions()).toHaveLength(1);
    });

    const arrowDownDefaultAllowed = await fireEvent.keyDown(input, { key: 'ArrowDown' });
    const arrowUpDefaultAllowed = await fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(arrowDownDefaultAllowed).toBe(true);
    expect(arrowUpDefaultAllowed).toBe(true);
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });
});

describe('Autocomplete — FormField context', () => {
  test('inherits described-by, invalid, required, and disabled from FormField context', () => {
    const { container } = render(FormFieldAutocompleteFixture, {
      props: {
        fieldId: 'fruit-search',
        fieldLabel: 'Favorite fruit',
        fieldDescription: 'Choose a fruit',
        fieldError: 'Field error',
        controlError: 'Parse error',
        required: true,
        disabled: true,
        suggestionSource: () => [],
      },
    });

    const input = getInput(container);
    expect(input.getAttribute('aria-describedby')).toBe(
      'fruit-search-description fruit-search-control-error',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
  });

  test('composes consumer aria-describedby and aria-invalid with FormField wiring', () => {
    const { container } = render(FormFieldAutocompleteFixture, {
      props: {
        fieldId: 'fruit-search',
        fieldLabel: 'Favorite fruit',
        fieldDescription: 'Choose a fruit',
        suggestionSource: () => [],
        autocompleteProps: {
          'aria-describedby': 'external-hint',
          'aria-invalid': 'grammar',
        },
      },
    });

    const input = getInput(container);
    expect(input.getAttribute('aria-describedby')).toBe('fruit-search-description external-hint');
    expect(input.getAttribute('aria-invalid')).toBe('grammar');
  });
});
