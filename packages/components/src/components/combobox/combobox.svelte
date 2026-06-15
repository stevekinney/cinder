<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Single-select input that filters a fixed option list as the user types, combining free-text search with constrained values.
   * @tag form
   * @tag autocomplete
   * @useWhen Choosing one value from a long list where typing is faster than scrolling.
   * @useWhen Letting users narrow options by substring while still requiring a constrained selection.
   * @avoidWhen Picking from a short fixed list with no need to filter — use select instead.
   * @avoidWhen Querying remote data or accepting free-text submissions — use search-field instead.
   * @related select, search-field, dropdown
   */
  export type { ComboboxOption, ComboboxProps } from './combobox.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import type { ComboboxOption, ComboboxProps } from './combobox.types.ts';
  import { untrack } from 'svelte';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    value = $bindable(''),
    inputValue = $bindable(''),
    options,
    label,
    placeholder,
    filter,
    description,
    error,
    disabled = false,
    maxVisibleOptions = 200,
    class: className,
    'aria-describedby': consumerDescribedBy,
  }: ComboboxProps<T> = $props();

  const listboxId = $derived(`${id}-listbox`);
  const descriptionId = $derived(describeId(id, !!description));
  // errId only included in aria-describedby when error is active.
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId, consumerDescribedBy));

  const defaultFilter = (option: ComboboxOption<T>, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      option.label.toLowerCase().includes(q) ||
      (option.description?.toLowerCase().includes(q) ?? false)
    );
  };

  const filteredOptions = $derived.by(() => {
    const fn = filter ?? defaultFilter;
    const matches: ComboboxOption<T>[] = [];
    for (const option of options) {
      if (fn(option, inputValue)) {
        matches.push(option);
        if (matches.length >= maxVisibleOptions) break;
      }
    }
    return matches;
  });

  let open = $state(false);
  let activeIndex = $state(-1);
  let inputElement = $state<HTMLInputElement | null>(null);
  let listboxElement = $state<HTMLElement | null>(null);
  let committedLabel = $state('');

  // Reset active index whenever the filtered set changes so we don't point
  // at a stale option.
  $effect(() => {
    void filteredOptions;
    if (activeIndex >= filteredOptions.length) {
      activeIndex = filteredOptions.length > 0 ? 0 : -1;
    }
  });

  // When a value is provided externally, mirror its label in the input box.
  // The current input text is read untracked so typing can keep driving filtering.
  $effect(() => {
    if (!value) {
      // Clearing the value (deselect/reset) must also clear the visible text;
      // otherwise the input keeps showing the previously selected option's label.
      if (untrack(() => inputValue)) inputValue = '';
      committedLabel = '';
      return;
    }
    const matched = options.find((option) => option.value === value);
    if (matched) {
      // `committedLabel` tracks the committed `value`'s label and must stay in
      // sync whenever a match exists — even when `inputValue` already shows that
      // label. Gating it behind the `inputValue !== matched.label` check left
      // `committedLabel` stale (''), so a later Escape restored to empty text.
      committedLabel = matched.label;
      if (untrack(() => inputValue) !== matched.label) {
        inputValue = matched.label;
      }
    }
  });

  const activeOptionId = $derived(
    activeIndex >= 0 && activeIndex < filteredOptions.length
      ? `${id}-option-${activeIndex}`
      : undefined,
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    open = true;
    activeIndex = filteredOptions.length > 0 ? 0 : -1;
  }

  function handleFocus() {
    if (!disabled) open = true;
  }

  function handleBlur(event: FocusEvent) {
    // Defer close so a click on a listbox option can complete first. Use a DOM
    // containment check rather than a `#${listboxId}` selector so ids with
    // CSS-special characters (colons, dots, leading digits) don't throw.
    const next = event.relatedTarget as Node | null;
    if (next && listboxElement?.contains(next)) return;
    open = false;
  }

  function selectOption(option: ComboboxOption<T>) {
    if (option.disabled) return;
    value = option.value;
    inputValue = option.label;
    committedLabel = option.label;
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open = true;
      if (filteredOptions.length === 0) return;
      activeIndex = (activeIndex + 1) % filteredOptions.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      open = true;
      if (filteredOptions.length === 0) return;
      activeIndex = activeIndex <= 0 ? filteredOptions.length - 1 : activeIndex - 1;
    } else if (event.key === 'Home') {
      if (!open) return;
      event.preventDefault();
      activeIndex = filteredOptions.length > 0 ? 0 : -1;
    } else if (event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      activeIndex = filteredOptions.length - 1;
    } else if (event.key === 'Enter' && open) {
      const option = filteredOptions[activeIndex];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    } else if (event.key === 'Escape') {
      // Close the dropdown directly. When the Popover is rendered, its
      // capture-phase escape-stack handler already set open = false before this
      // handler runs; this assignment is then an idempotent no-op. But the
      // Popover only mounts while there are filtered options to show, so an open
      // combobox whose input filtered every option away (open && filtered === 0)
      // has NO escape handler on the stack — without this line Escape would
      // leave it stuck open.
      open = false;
      // Restore inputValue unconditionally when Escape is pressed while the
      // input is focused, regardless of whether open was still true.
      if (inputValue !== committedLabel) {
        event.preventDefault();
        inputValue = committedLabel;
        if (inputElement) inputElement.value = committedLabel;
      }
    }
  }
</script>

<div class={classNames('cinder-combobox', className)}>
  {#if label}
    <label for={id} class="cinder-combobox__label" data-disabled={disabled || undefined}>
      {label}
    </label>
  {/if}

  <div class="cinder-combobox__control" data-cinder-open={open || undefined}>
    <input
      bind:this={inputElement}
      {id}
      type="text"
      role="combobox"
      class="cinder-combobox__input"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      {disabled}
      {placeholder}
      value={inputValue}
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={activeOptionId}
      aria-invalid={ariaInvalid(!!error)}
      aria-describedby={describedBy}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
    />
  </div>

  {#if open && filteredOptions.length > 0}
    <Popover
      bind:open
      id={listboxId}
      triggerRef={inputElement}
      role="listbox"
      focusManagement="preserve"
      wireTriggerAria={false}
      widthMode="match-anchor"
      class="cinder-combobox__panel"
    >
      <ul bind:this={listboxElement} role="presentation" class="cinder-combobox__listbox">
        {#each filteredOptions as option, index (option.value)}
          <li
            id="{id}-option-{index}"
            role="option"
            class="cinder-_option-row cinder-combobox__option"
            aria-selected={value === option.value}
            aria-disabled={option.disabled || undefined}
            aria-label={option.description ? `${option.label}, ${option.description}` : undefined}
            data-cinder-active={index === activeIndex || undefined}
            onmousedown={(event) => {
              // mousedown rather than click so the option fires before the
              // input's blur cancels the popover.
              event.preventDefault();
              selectOption(option);
            }}
            onmouseenter={() => {
              activeIndex = index;
            }}
          >
            {#if option.avatar?.trim()}
              <img
                class="cinder-combobox__option-avatar"
                src={option.avatar}
                alt=""
                loading="lazy"
              />
            {/if}
            <span class="cinder-combobox__option-text">
              <span class="cinder-combobox__option-label">{option.label}</span>
              {#if option.description}
                <span class="cinder-combobox__option-description">{option.description}</span>
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </Popover>
  {/if}

  <!-- Always in DOM so screen readers hear "No results" when text is injected.
       Freshly-mounted role="status" nodes are not reliably announced by NVDA/JAWS. -->
  <div
    class="cinder-combobox__empty"
    role="status"
    data-cinder-active={(open && filteredOptions.length === 0) || undefined}
  >
    {open && filteredOptions.length === 0 ? 'No results' : ''}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-combobox__description">{description}</p>
  {/if}

  <!-- Always in DOM for the same reason — live region must pre-exist before text is injected. -->
  <p
    id="{id}-error"
    class="cinder-combobox__error"
    aria-live="polite"
    data-cinder-error={!!error || undefined}
  >
    {error ?? ''}
  </p>
</div>
