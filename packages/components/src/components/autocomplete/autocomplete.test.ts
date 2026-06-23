/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
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
    // Strip CSS comments first — the explanatory comment in this rule intentionally
    // quotes the old broken values, so the negative assertions below must run
    // against the declarations only, not the comment text.
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const matchRule = cssWithoutComments.slice(
      cssWithoutComments.indexOf('.cinder-autocomplete__match'),
    );
    const ruleBody = matchRule.slice(0, matchRule.indexOf('}'));
    // Pin to the actual background:/color: declarations.
    expect(ruleBody).toMatch(/background:\s*var\(--cinder-color-warning-bg\)/);
    expect(ruleBody).toMatch(/color:\s*var\(--cinder-color-warning-fg\)/);
    // The broken hard-coded near-white background must be gone from the declarations.
    expect(ruleBody).not.toMatch(/oklch\(from var\(--cinder-warning\)/);
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

  test('the keyboard-active option carries the shared option-row class so its highlight is distinct from the panel', async () => {
    // Regression: autocomplete.css previously pinned
    // `.cinder-autocomplete__option[data-cinder-active]` to
    // `--cinder-surface-raised` — the exact token the floating panel uses for
    // its own background — so the keyboard-highlighted option was invisible
    // against the panel in light mode. The active-row treatment is now owned by
    // the shared `.cinder-_option-row[data-cinder-active]` rules: a
    // `--cinder-surface-hover` background PLUS an inset `--cinder-ring-color`
    // ring that clears WCAG 1.4.11 (3:1) for the keyboard cursor.
    // This asserts (1) the active option carries `cinder-_option-row` at
    // runtime, (2) the component CSS no longer reintroduces the override, and
    // (3) the shared rule still provides the contrast-clearing ring.
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

    const activeOption = getOptions().find(
      (option) => option.getAttribute('data-cinder-active') !== null,
    );
    expect(activeOption).toBeDefined();
    // The shared `_floating-surface.css` rules key off this class, so carrying
    // it is what gives the active row its background + keyboard-cursor ring.
    expect(activeOption?.classList.contains('cinder-_option-row')).toBe(true);

    // happy-dom does not apply stylesheets, so assert against CSS source. The
    // component must not re-pin the active row to the panel's own
    // `--cinder-surface-raised` background. Anchor to a rule open-brace with a
    // negative lookbehind so a *compound* selector (e.g. one that also carries
    // `cinder-_option-row`, which does not reproduce the bug) does not false-fail.
    const componentCss = await Bun.file(new URL('./autocomplete.css', import.meta.url)).text();
    const componentCssWithoutComments = componentCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(componentCssWithoutComments).not.toMatch(
      /(?<![.\w-])\.cinder-autocomplete__option\[data-cinder-active\]\s*\{/,
    );

    // The contrast-clearing keyboard-cursor ring lives in the shared rule.
    // Pin it here so the affordance cannot be silently dropped: the active row
    // must inset a `--cinder-ring-color` ring (the system focus-ring token,
    // tuned to clear 3:1 against near-white surfaces).
    const sharedCss = await Bun.file(
      new URL('../../styles/components/_floating-surface.css', import.meta.url),
    ).text();
    const sharedCssWithoutComments = sharedCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sharedCssWithoutComments).toMatch(
      /\.cinder-_option-row\[data-cinder-active\]\s*\{[^}]*box-shadow:\s*inset[^}]*var\(--cinder-ring-color\)/,
    );

    // Forced-colors fallback: a row that is BOTH selected and the keyboard
    // cursor must keep its `Highlight` outline. The `aria-selected` reset is
    // guarded by `:not([data-cinder-active])` so it cannot win on source order
    // (equal specificity) and erase the cursor on a selected-active row. Assert
    // the guard is present and that no UNGUARDED bare `[aria-selected='true']`
    // reset survives inside the forced-colors block.
    expect(sharedCssWithoutComments).toMatch(
      /\.cinder-_option-row\[aria-selected='true'\]:not\(\[data-cinder-active\]\)\s*\{\s*outline:\s*none/,
    );
    expect(sharedCssWithoutComments).not.toMatch(
      /\.cinder-_option-row\[aria-selected='true'\]\s*\{\s*outline:\s*none/,
    );
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
    // resolveFieldControl composes both the control-level and context-level error ids;
    // the deduplication pass removes the context description that also appears in
    // context.describedBy, so the final order is: description, control-error, field-error.
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('fruit-search-description');
    expect(describedBy).toContain('fruit-search-control-error');
    // The FormField's own (field-level) error id must also be composed in — assert it
    // explicitly so a future regression that drops it can't pass silently.
    expect(describedBy).toContain('fruit-search-error');
    // No id appears more than once after de-duplication.
    const tokens = describedBy.split(/\s+/).filter(Boolean);
    expect(new Set(tokens).size).toBe(tokens.length);
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

describe('Autocomplete — out-of-portal status live region', () => {
  // The statusMessage live region lives OUTSIDE the portaled Popover so screen
  // readers reliably hear loading/empty status. These tests verify the announcement
  // region exists and announces the correct content for each state.
  test('a persistent role=status region is always present (never portaled)', () => {
    const { container } = render(Autocomplete, {
      props: { id: 'test', suggestionSource: () => [] },
    });
    // Must exist even when the popover is closed — "always-present" per PLATFORM-POLICY.
    const statusRegion = container.querySelector('[role="status"]');
    expect(statusRegion).not.toBeNull();
    expect(statusRegion?.getAttribute('aria-live')).toBe('polite');
    expect(statusRegion?.getAttribute('aria-atomic')).toBe('true');
    // Must NOT be inside the portaled listbox (the portal is appended to body, not container).
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.contains(statusRegion)).toBeFalsy();
  });

  test('announces loadingMessage while a fetch is in-flight', async () => {
    let resolveRequest!: (suggestions: { label: string; value: string }[]) => void;
    const source = () =>
      new Promise<{ label: string; value: string }[]>((resolve) => {
        resolveRequest = resolve;
      });
    const { container } = render(Autocomplete, {
      props: {
        id: 'async-ac',
        loadingMessage: 'Searching…',
        minQueryLength: 1,
        suggestionSource: source,
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'a' } });

    const statusRegion = () => container.querySelector('[role="status"]');
    await waitFor(() => {
      expect(statusRegion()?.textContent?.trim()).toBe('Searching…');
    });

    // Resolve with results — status should clear.
    resolveRequest([{ label: 'Apple', value: 'apple' }]);
    await waitFor(() => {
      expect(statusRegion()?.textContent?.trim()).toBe('');
    });
  });

  test('announces emptyMessage when the popover is open with zero suggestions', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'empty-ac',
        emptyMessage: 'No matches found',
        minQueryLength: 1,
        suggestionSource: () => [],
      },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'z' } });

    const statusRegion = () => container.querySelector('[role="status"]');
    await waitFor(() => {
      expect(statusRegion()?.textContent?.trim()).toBe('No matches found');
    });
  });
});

describe('Autocomplete — each-key behavior', () => {
  test('deduplicates suggestions and emits a devWarn when the source returns duplicate values', async () => {
    // With in-flight dedup, duplicate suggestion values are removed before
    // being assigned to state, so the keyed {#each} never sees a collision
    // and Svelte cannot throw each_key_duplicate. The test asserts that:
    //   1. No crash occurs (no try/catch needed).
    //   2. Only the first occurrence of each value is rendered.
    //   3. The dropdown opens (stale suggestions are not retained).
    //   4. The devWarn fires so the developer is notified.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const duplicateFruits = [
      { value: 'apple', label: 'Apple' },
      { value: 'apple', label: 'Apple (duplicate)' },
      { value: 'banana', label: 'Banana' },
    ];
    try {
      const { container } = render(Autocomplete, {
        props: {
          id: 'dup-search',
          suggestionSource: () => duplicateFruits,
        },
      });
      const input = container.querySelector('input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'a' } });
      // Wait for the deduped suggestions to be committed to state and rendered.
      await waitFor(() => {
        const enabledOptions = getOptions().filter((o) => !o.getAttribute('aria-disabled'));
        expect(enabledOptions).toHaveLength(2);
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate suggestion values'));
      // The deduped list (apple + banana) renders; the second 'apple' is dropped.
      const enabledOptions = getOptions().filter((o) => !o.getAttribute('aria-disabled'));
      expect(enabledOptions).toHaveLength(2);
      expect(enabledOptions[0]?.textContent).toContain('Apple');
      expect(enabledOptions[1]?.textContent).toContain('Banana');
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not warn when suggestion values are all unique', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(Autocomplete, {
        props: {
          id: 'unique-search',
          suggestionSource: () => fruits,
        },
      });
      const input = container.querySelector('input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'a' } });

      await waitFor(() => {
        expect(getOptions().length).toBeGreaterThan(0);
      });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('dedups duplicates beyond the visible window (whole list, not just the slice)', async () => {
    // Regression for a duplicate value living in the TAIL beyond
    // maxVisibleSuggestions: deduping only the visible prefix would leave the
    // tail duplicate in `suggestions`, and a wider re-slice (or a tail value
    // colliding with the visible prefix) would crash the keyed {#each} with
    // each_key_duplicate. Deduping the full list prevents that.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // visible window of 2; 'apple' appears at index 0 AND index 2 (the tail).
      const withTailDuplicate = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
        { value: 'apple', label: 'Apple (tail duplicate)' },
        { value: 'cherry', label: 'Cherry' },
      ];
      const { container } = render(Autocomplete, {
        props: {
          id: 'tail-dup-search',
          maxVisibleSuggestions: 2,
          suggestionSource: () => withTailDuplicate,
        },
      });
      const input = container.querySelector('input') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'a' } });

      // No crash; the deduped list is apple/banana/cherry, sliced to 2 visible.
      await waitFor(() => {
        const enabled = getOptions().filter((o) => !o.getAttribute('aria-disabled'));
        expect(enabled).toHaveLength(2);
      });
      const enabled = getOptions().filter((o) => !o.getAttribute('aria-disabled'));
      expect(enabled[0]?.textContent).toContain('Apple');
      expect(enabled[1]?.textContent).toContain('Banana');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate suggestion values'));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('Autocomplete — active-index clamping via $derived (no write-back $effect)', () => {
  test('first enabled option is auto-selected when suggestions arrive', async () => {
    // Regression: the old code used a $effect that called clampActiveIndex on
    // every renderedSuggestions change. It is replaced by a $derived activeIndex
    // that auto-clamps from enabledIndexes without a write-back effect.
    const { promise: pending, resolve: resolveRequest } = deferred<Suggestion[]>();
    const { container } = render(Autocomplete, {
      props: {
        id: 'ac-clamp',
        minQueryLength: 1,
        suggestionSource: () => pending,
      },
    });

    const input = getInput(container);
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'a' } });

    // Resolve with a disabled first option so clamping must skip to second.
    resolveRequest([
      { value: 'apple', label: 'Apple', disabled: true },
      { value: 'apricot', label: 'Apricot' },
    ]);

    await waitFor(() => {
      const options = getOptions();
      expect(options).toHaveLength(2);
      // The first enabled option (apricot, index 1) must be aria-selected.
      expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    });
  });

  test('active index falls back to null when all suggestions are disabled', async () => {
    const { container } = render(Autocomplete, {
      props: {
        id: 'ac-all-disabled',
        minQueryLength: 1,
        suggestionSource: () => [
          { value: 'apple', disabled: true },
          { value: 'apricot', disabled: true },
        ],
      },
    });

    const input = getInput(container);
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'a' } });

    await waitFor(() => {
      const options = getOptions();
      expect(options.every((option) => option.getAttribute('aria-selected') === 'false')).toBe(
        true,
      );
    });
  });
});
