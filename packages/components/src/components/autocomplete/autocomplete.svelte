<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Free-form text input with asynchronous suggestion hints rendered in a listbox popover.
   * @tag form
   * @tag autocomplete
   * @useWhen Accepting arbitrary text while offering completions from a local or remote source.
   * @useWhen Keeping the user's text as the committed value while suggestions remain optional hints.
   * @avoidWhen Requiring the final value to come from a fixed option list — use combobox instead.
   * @related combobox, search-field, popover
   */
  export type {
    AutocompleteProps,
    AutocompleteSuggestion,
    AutocompleteSuggestionSource,
    AutocompleteSuggestionSourceContext,
  } from './autocomplete.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';

  import type { AutocompleteProps, AutocompleteSuggestion } from './autocomplete.types.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    value = $bindable(''),
    suggestionSource,
    label,
    description,
    error,
    minQueryLength = 1,
    maxVisibleSuggestions = 50,
    placeholder,
    disabled,
    required,
    readonly = false,
    emptyMessage = 'No suggestions',
    loadingMessage = 'Loading suggestions',
    class: className,
    oninput,
    oncomplete,
    ...rest
  }: AutocompleteProps = $props();

  const context = getFormFieldContext();
  const generatedId = $props.id();

  const resolvedId = $derived(id ?? context?.controlId ?? generatedId);
  const listboxId = $derived(`${resolvedId}-listbox`);
  const resolvedMinQueryLength = $derived(toNonNegativeInteger(minQueryLength, 1));
  const resolvedMaxVisibleSuggestions = $derived(toNonNegativeInteger(maxVisibleSuggestions, 50));

  $effect(() => {
    if (!DEV) return;
    if (context && id && context.controlId !== id) {
      console.warn(
        `[cinder/Autocomplete] id mismatch: Autocomplete id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  const defaultDescriptionId = $derived(describeId(resolvedId, !!description));
  const defaultErrorId = $derived(buildErrorId(resolvedId, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${resolvedId}-control-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${resolvedId}-control-error` : defaultErrorId,
  );
  const consumerDescribedBy = $derived(rest['aria-describedby']);
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(
    composeDescribedBy(resolvedDescriptionId, resolvedErrorId, consumerDescribedBy),
  );
  const resolvedAriaInvalid = $derived(
    error ? ariaInvalid(true) : (context?.invalid ?? rest['aria-invalid'] ?? ariaInvalid(false)),
  );
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  let inputElement = $state<HTMLInputElement | null>(null);
  let open = $state(false);
  let loading = $state(false);
  let composing = $state(false);
  let inputFocused = $state(false);
  let suggestions = $state<AutocompleteSuggestion[]>([]);
  let activeIndex = $state<number | null>(null);
  let suppressNextQuery = false;
  let ignoreSyntheticInput = false;
  let completionPointerIndex = $state<number | null>(null);

  let requestVersion = 0;

  const renderedSuggestions = $derived(suggestions.slice(0, resolvedMaxVisibleSuggestions));
  const enabledIndexes = $derived(getEnabledIndexes(renderedSuggestions));
  const activeDescendant = $derived(
    activeIndex === null ? undefined : `${resolvedId}-option-${activeIndex}`,
  );

  function isEligibleQuery(query: string): boolean {
    return (
      !resolvedDisabled && !readonly && !!suggestionSource && query.length >= resolvedMinQueryLength
    );
  }

  function toNonNegativeInteger(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.trunc(value));
  }

  function getEnabledIndexes(list: AutocompleteSuggestion[]): number[] {
    const indexes: number[] = [];
    list.forEach((suggestion, index) => {
      if (!suggestion.disabled) indexes.push(index);
    });
    return indexes;
  }

  function clampActiveIndex(list: AutocompleteSuggestion[]): void {
    const availableEnabledIndexes =
      list === renderedSuggestions ? enabledIndexes : getEnabledIndexes(list);
    if (availableEnabledIndexes.length === 0) {
      activeIndex = null;
      return;
    }
    if (activeIndex !== null && availableEnabledIndexes.includes(activeIndex)) return;
    activeIndex = availableEnabledIndexes[0] ?? null;
  }

  $effect(() => {
    void renderedSuggestions;
    clampActiveIndex(renderedSuggestions);
  });

  function closePopup(options: { clearSuggestions?: boolean } = {}): void {
    open = false;
    loading = false;
    activeIndex = null;
    if (options.clearSuggestions) suggestions = [];
  }

  $effect(() => {
    const query = value;
    const source = suggestionSource;
    const isFocused = inputFocused;

    if (suppressNextQuery) {
      suppressNextQuery = false;
      return;
    }

    if (!isFocused || !isEligibleQuery(query) || !source) {
      suggestions = [];
      closePopup();
      return;
    }

    const currentVersion = ++requestVersion;
    const controller = new AbortController();
    loading = true;
    open = true;
    suggestions = [];
    activeIndex = null;

    let result: AutocompleteSuggestion[] | Promise<AutocompleteSuggestion[]>;
    try {
      if (controller.signal.aborted || currentVersion !== requestVersion) return;
      result = source(query, { signal: controller.signal });
    } catch (errorValue: unknown) {
      if (controller.signal.aborted || currentVersion !== requestVersion) return;
      suggestions = [];
      closePopup();
      if (DEV) {
        console.warn('[cinder/autocomplete] suggestionSource failed.', errorValue);
      }
      return;
    }

    Promise.resolve(result)
      .then((nextSuggestions) => {
        if (controller.signal.aborted || currentVersion !== requestVersion) return;
        suggestions = nextSuggestions;
        loading = false;
        open = true;
        clampActiveIndex(nextSuggestions.slice(0, resolvedMaxVisibleSuggestions));
      })
      .catch((errorValue: unknown) => {
        if (controller.signal.aborted || currentVersion !== requestVersion) return;
        suggestions = [];
        closePopup();
        if (DEV) {
          console.warn('[cinder/autocomplete] suggestionSource failed.', errorValue);
        }
      });

    return () => {
      controller.abort();
    };
  });

  function highlightParts(text: string, query: string): [string, string, string] | null {
    if (!query) return null;
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return null;
    const matchIndex = text.toLowerCase().indexOf(normalizedQuery.toLowerCase());
    if (matchIndex < 0) return null;
    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    const after = text.slice(matchIndex + normalizedQuery.length);
    return [before, match, after];
  }

  function moveActive(direction: 1 | -1): void {
    if (enabledIndexes.length === 0) return;

    open = true;
    if (activeIndex === null) {
      activeIndex = direction === 1 ? (enabledIndexes[0] ?? null) : (enabledIndexes.at(-1) ?? null);
      return;
    }

    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition < 0
        ? 0
        : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    activeIndex = enabledIndexes[nextPosition] ?? null;
  }

  function moveToBoundary(direction: 'start' | 'end'): void {
    if (!open) return;
    if (enabledIndexes.length === 0) return;
    activeIndex =
      direction === 'start' ? (enabledIndexes[0] ?? null) : (enabledIndexes.at(-1) ?? null);
  }

  function dispatchCompletionInputEvent(): void {
    if (!inputElement) return;
    ignoreSyntheticInput = true;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function completeSuggestion(suggestion: AutocompleteSuggestion | undefined): void {
    if (!suggestion || suggestion.disabled) return;

    suppressNextQuery = true;
    value = suggestion.value;
    if (inputElement) inputElement.value = suggestion.value;
    closePopup({ clearSuggestions: true });
    oninput?.(suggestion.value);
    oncomplete?.(suggestion);
    dispatchCompletionInputEvent();
  }

  function handleInput(event: Event): void {
    if (ignoreSyntheticInput) {
      ignoreSyntheticInput = false;
      return;
    }
    inputFocused = true;
    const target = event.currentTarget as HTMLInputElement;
    value = target.value;
    oninput?.(target.value);
  }

  function handleFocus(): void {
    inputFocused = true;
    if (isEligibleQuery(value)) {
      open = true;
    }
  }

  function handleBlur(): void {
    inputFocused = false;
    closePopup();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      if (enabledIndexes.length === 0) return;
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (enabledIndexes.length === 0) return;
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === 'Home') {
      if (!open || enabledIndexes.length === 0) return;
      event.preventDefault();
      moveToBoundary('start');
      return;
    }

    if (event.key === 'End') {
      if (!open || enabledIndexes.length === 0) return;
      event.preventDefault();
      moveToBoundary('end');
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closePopup();
      return;
    }

    if (event.key === 'Enter' && open && !composing) {
      const suggestion = activeIndex === null ? undefined : renderedSuggestions[activeIndex];
      if (suggestion && !suggestion.disabled) {
        event.preventDefault();
        completeSuggestion(suggestion);
      }
    }
  }

  function handlePointerComplete(event: MouseEvent, index: number): void {
    event.preventDefault();
    completionPointerIndex = index;
    completeSuggestion(renderedSuggestions[index]);
    queueMicrotask(() => {
      if (completionPointerIndex === index) completionPointerIndex = null;
    });
  }

  function handleMouseDownFallback(event: MouseEvent, index: number): void {
    if (completionPointerIndex === index) {
      completionPointerIndex = null;
      return;
    }
    event.preventDefault();
    completeSuggestion(renderedSuggestions[index]);
  }
</script>

<div
  class={classNames('cinder-autocomplete', className)}
  data-disabled={resolvedDisabled ? '' : undefined}
  data-invalid={resolvedAriaInvalid === 'true' ? '' : undefined}
>
  {#if label}
    <label
      for={resolvedId}
      class="cinder-autocomplete__label"
      data-disabled={resolvedDisabled || undefined}
    >
      {label}
    </label>
  {/if}

  <input
    bind:this={inputElement}
    {...rest}
    id={resolvedId}
    type="text"
    class="cinder-autocomplete__input"
    {value}
    {placeholder}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    {readonly}
    autocomplete={rest.autocomplete ?? 'off'}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={open ? listboxId : undefined}
    aria-activedescendant={activeDescendant}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    oncompositionstart={() => {
      composing = true;
    }}
    oncompositionend={() => {
      composing = false;
    }}
  />

  {#if description}
    <p id={ownDescriptionId} class="cinder-autocomplete__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-autocomplete__error" aria-live="polite">{error}</p>
  {/if}
</div>

<Popover
  bind:open
  id={listboxId}
  triggerRef={inputElement}
  role="listbox"
  focusManagement="preserve"
  wireTriggerAria={false}
  class="cinder-autocomplete__panel"
>
  {#if loading}
    <div
      id={`${resolvedId}-status-loading`}
      role="option"
      tabindex="-1"
      class="cinder-autocomplete__option cinder-autocomplete__status"
      aria-selected="false"
      aria-disabled="true"
    >
      {loadingMessage}
    </div>
  {:else if renderedSuggestions.length === 0}
    <div
      id={`${resolvedId}-status-empty`}
      role="option"
      tabindex="-1"
      class="cinder-autocomplete__option cinder-autocomplete__status"
      aria-selected="false"
      aria-disabled="true"
    >
      {emptyMessage}
    </div>
  {:else}
    {#each renderedSuggestions as suggestion, index (`${suggestion.value}-${index}`)}
      {@const suggestionLabel = suggestion.label ?? suggestion.value}
      {@const parts = highlightParts(suggestionLabel, value)}
      <div
        id={`${resolvedId}-option-${index}`}
        role="option"
        tabindex="-1"
        class="cinder-autocomplete__option"
        aria-selected={index === activeIndex}
        aria-disabled={suggestion.disabled || undefined}
        data-cinder-active={index === activeIndex || undefined}
        data-cinder-disabled={suggestion.disabled || undefined}
        onpointerdown={(event) => {
          handlePointerComplete(event, index);
        }}
        onmousedown={(event) => {
          handleMouseDownFallback(event, index);
        }}
        onmouseenter={() => {
          if (!suggestion.disabled) activeIndex = index;
        }}
      >
        <span class="cinder-autocomplete__option-text">
          <span class="cinder-autocomplete__option-label">
            {#if parts}
              {parts[0]}<mark class="cinder-autocomplete__match">{parts[1]}</mark>{parts[2]}
            {:else}
              {suggestionLabel}
            {/if}
          </span>
          {#if suggestion.description}
            <span class="cinder-autocomplete__option-description">{suggestion.description}</span>
          {/if}
        </span>
      </div>
    {/each}
  {/if}
</Popover>
