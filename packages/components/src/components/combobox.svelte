<script lang="ts" module>
  /**
   * One option in a Combobox.
   */
  export type ComboboxOption = {
    /** Submitted value. */
    value: string;
    /** Visible label (primary line). */
    label: string;
    /** Optional secondary description rendered beneath the label inside the option. */
    description?: string;
    /**
     * Optional avatar image URL rendered to the left of the label.
     * The avatar is decorative — its alt text is empty because the
     * option's accessible name already includes the label.
     */
    avatar?: string;
    /** When true, the option is non-selectable. */
    disabled?: boolean;
  };

  /**
   * Props for the Combobox component.
   *
   * v1 scope (deliberately small):
   * - Single-select only.
   * - Synchronous local filtering — consumer supplies a `filter` callback,
   *   or the default substring-on-label match runs.
   * - No async / remote loading; no debounced fetch.
   * - No virtualization. Visible options are capped at 200; consumers with
   *   larger lists must paginate or pre-filter externally.
   * - No multi-select, no token chips, no "create new" / free-text submission.
   *
   * Bigger Combobox patterns will live as separate components or as an
   * extension once consumer needs justify them.
   */
  export type ComboboxProps = {
    /** Unique identifier — required for label association and ARIA wiring. */
    id: string;
    /** Currently selected value. Bindable. */
    value?: string;
    /** Free-text input value (the text the user has typed). Bindable. */
    inputValue?: string;
    /** Full set of options to filter. */
    options: ComboboxOption[];
    /** Visible label rendered in a `<label>` associated via `for`. */
    label?: string;
    /** Placeholder when no value is selected. */
    placeholder?: string;
    /**
     * Custom synchronous filter. Receives an option and the current input
     * value; returns true to keep. Defaults to case-insensitive substring
     * match on label.
     */
    filter?: (option: ComboboxOption, query: string) => boolean;
    /** Helper text displayed below the input; wired via aria-describedby. */
    description?: string;
    /** Validation error message; sets aria-invalid="true". */
    error?: string;
    /** Disables the combobox. */
    disabled?: boolean;
    /** Hard cap on visible filtered options. Default 200. */
    maxVisibleOptions?: number;
    /** Additional class names merged with `.cinder-combobox`. */
    class?: string;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { cn } from '../utilities/class-names.ts';

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
  }: ComboboxProps = $props();

  const listboxId = `${id}-listbox`;
  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));

  const defaultFilter = (option: ComboboxOption, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      option.label.toLowerCase().includes(q) ||
      (option.description?.toLowerCase().includes(q) ?? false)
    );
  };

  const filteredOptions = $derived.by(() => {
    const fn = filter ?? defaultFilter;
    const matches: ComboboxOption[] = [];
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

  // Reset active index whenever the filtered set changes so we don't point
  // at a stale option.
  $effect(() => {
    void filteredOptions;
    if (activeIndex >= filteredOptions.length) {
      activeIndex = filteredOptions.length > 0 ? 0 : -1;
    }
  });

  // When a value is provided externally, mirror its label in the input box.
  // This runs only when value changes, not when the user types.
  $effect(() => {
    if (!value) return;
    const matched = options.find((option) => option.value === value);
    if (matched && inputValue !== matched.label) {
      inputValue = matched.label;
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
    // Defer close so a click on a listbox option can complete first.
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.closest(`#${listboxId}`)) return;
    open = false;
  }

  function selectOption(option: ComboboxOption) {
    if (option.disabled) return;
    value = option.value;
    inputValue = option.label;
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
      if (open) {
        event.preventDefault();
        open = false;
      }
    }
  }
</script>

<div class={cn('cinder-combobox', className)}>
  {#if label}
    <label for={id} class="cinder-combobox__label" data-disabled={disabled || undefined}>
      {label}
    </label>
  {/if}

  <div class="cinder-combobox__control" data-cinder-open={open || undefined}>
    <input
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
    <ul id={listboxId} role="listbox" class="cinder-combobox__listbox">
      {#each filteredOptions as option, index (option.value)}
        <li
          id="{id}-option-{index}"
          role="option"
          class="cinder-combobox__option"
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
            <img class="cinder-combobox__option-avatar" src={option.avatar} alt="" loading="lazy" />
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
  {:else if open && filteredOptions.length === 0}
    <div class="cinder-combobox__empty" role="status">No results</div>
  {/if}

  {#if description}
    <p id={descriptionId} class="cinder-combobox__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-combobox__error" aria-live="polite">{error}</p>
  {/if}
</div>
