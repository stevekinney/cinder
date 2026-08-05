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

<script lang="ts" generics="T extends string = string, AllowCustom extends boolean = false">
  import type { ComboboxOption, ComboboxProps } from './combobox.types.ts';
  import { untrack } from 'svelte';

  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createCommandListState } from '../_internal/create-command-list-state.svelte.ts';
  import Popover from '../popover/popover.svelte';

  let {
    id,
    value = $bindable(''),
    onchange,
    name,
    textInputValue = $bindable(''),
    options,
    label,
    'aria-label': ariaLabel,
    placeholder,
    filter,
    description,
    error,
    disabled,
    required,
    maxVisibleOptions = 200,
    customValueAllowed = false as AllowCustom,
    class: className,
    'aria-describedby': consumerDescribedBy,
  }: ComboboxProps<T, AllowCustom> = $props();

  const context = getFormFieldContext();
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'combobox',
      consumerDescribedBy,
      required,
      disabled,
    }),
  );
  const resolvedDisabled = $derived(field.disabled);
  const resolvedRequired = $derived(field.required);
  const describedBy = $derived(field.describedBy);

  const listboxId = $derived(`${id}-listbox`);
  // `autoActivateFirst: false` — an editable combobox shows no highlighted
  // option until the user types or explicitly navigates, unlike a
  // button-triggered listbox (MultiSelect, CommandMenu).
  const commandList = createCommandListState(() => listboxId, { autoActivateFirst: false });
  const descriptionId = $derived(field.ownDescriptionId);
  // Stable id for the always-in-DOM error live region when no error is active.
  // Mirrors Select: avoids colliding with a wrapping FormField's error id.
  const stableLocalErrorId = $derived(
    context?.errorId === `${field.id}-error` ? `${field.id}-combobox-error` : `${field.id}-error`,
  );

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
      if (fn(option, textInputValue)) {
        matches.push(option);
        if (matches.length >= maxVisibleOptions) break;
      }
    }
    return matches;
  });

  let open = $state(false);
  let inputElement = $state<HTMLInputElement | null>(null);
  let hiddenInputElement = $state<HTMLInputElement | null>(null);
  let listboxElement = $state<HTMLElement | null>(null);
  let committedLabel = $state('');
  let initialCustomValue = $state('');
  let hasUserCommittedValue = $state(false);
  let hasExplicitNavigation = $state(false);
  let hasStoredInitialValue = $state(false);
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  let initialValue = $state(untrack(() => value));
  const initialInputValue = untrack(() => textInputValue);

  $effect.pre(() => {
    if (!hasUserCommittedValue && !hasStoredInitialValue && value) {
      initialValue = value;
      hasStoredInitialValue = true;
    }
    if (customValueAllowed && !hasUserCommittedValue && value && !initialCustomValue) {
      initialCustomValue = value;
    }
  });

  // When a value is provided externally, mirror its label in the input box.
  // The current input text is read untracked so typing can keep driving filtering.
  $effect(() => {
    if (!value) {
      // Clearing the value (deselect/reset) must also clear the visible text;
      // otherwise the input keeps showing the previously selected option's label.
      if (untrack(() => textInputValue)) textInputValue = '';
      committedLabel = '';
      return;
    }
    const matched = options.find((option) => option.value === value);
    if (matched) {
      // `committedLabel` tracks the committed `value`'s label and must stay in
      // sync whenever a match exists — even when `textInputValue` already shows that
      // label. Gating it behind the `textInputValue !== matched.label` check left
      // `committedLabel` stale (''), so a later Escape restored to empty text.
      committedLabel = matched.label;
      if (untrack(() => textInputValue) !== matched.label) {
        textInputValue = matched.label;
      }
    } else if (customValueAllowed) {
      if (!initialCustomValue) initialCustomValue = value;
      committedLabel = value;
      if (untrack(() => textInputValue) !== value) textInputValue = value;
    }
  });

  // Escape ownership.
  //
  // The combobox is the single Escape owner for the whole time it is open. The
  // option Popover is told `closeOnEscape={false}`, so it never registers its
  // own escape-stack handler — otherwise, while options are visible, the
  // Popover's handler would sit on top of the shared LIFO stack and shadow this
  // one. With the Popover opting out, this combobox's handler is the top-most
  // Escape consumer for the entire open session, including the empty-filter gap
  // (`open && filteredOptions.length === 0`) where the Popover is unmounted.
  //
  // That matters most when the combobox is nested inside a Modal/Sheet: the
  // shared escape stack's window listener is capture-phase and invokes ONLY its
  // top handler, so this combobox consumes Escape and `preventDefault()`s it
  // before the parent overlay ever sees the key — Escape dismisses just the
  // combobox, never the enclosing overlay.
  function handleEscape(event: KeyboardEvent | undefined = undefined): void {
    const wasOpen = open;
    open = false;
    // Restore the committed label whenever the live text drifted from it.
    if (textInputValue !== committedLabel) {
      textInputValue = committedLabel;
      if (inputElement) inputElement.value = committedLabel;
    }
    // Swallow the key if the combobox actually consumed this Escape (it was
    // open) so the same keystroke doesn't also dismiss an enclosing overlay or
    // trigger a page-level default.
    if (wasOpen) event?.preventDefault();
  }

  $effect(() => {
    if (!open) return;
    const releaseEscape = pushEscapeHandler(handleEscape);
    return releaseEscape;
  });

  const listboxVisible = $derived(open && filteredOptions.length > 0);
  const emptyVisible = $derived(open && filteredOptions.length === 0);
  const activeOptionId = $derived(
    listboxVisible ? (commandList.activeItemId ?? undefined) : undefined,
  );
  const activeIndex = $derived(
    commandList.activeItemId === null
      ? -1
      : filteredOptions.findIndex(
          (_, index) => `${id}-option-${index}` === commandList.activeItemId,
        ),
  );

  /** First non-disabled index in `filteredOptions`, or -1 if none. */
  function firstEnabledFilteredIndex(): number {
    return filteredOptions.findIndex((option) => !option.disabled);
  }

  /** Indexes of every non-disabled option in `filteredOptions`, in order. */
  function enabledFilteredIndexes(): number[] {
    const indexes: number[] = [];
    filteredOptions.forEach((option, index) => {
      if (!option.disabled) indexes.push(index);
    });
    return indexes;
  }

  /**
   * Sets the active option by its position in `filteredOptions`, translating
   * to the shared `commandList`'s id-based `activeItemId`. `commandList`
   * registers option ids asynchronously (see the `syncItems` effect below) —
   * this can run before that registration completes, since the roving index
   * itself is computed directly from `filteredOptions` rather than from
   * `commandList.enabledIds`. `activeItemId` is `$derived`, so once
   * registration catches up it re-resolves to the id set here; no explicit
   * ordering between the two is required.
   *
   * `commandList.activeItemId` only ever resolves to an *enabled* id (see
   * `enabledIds` in create-command-list-state.svelte.ts) — passing a disabled
   * option's index here would silently collapse `activeItemId` back to
   * `null` instead of "sticking" on it. Callers must only pass indexes from
   * `enabledFilteredIndexes()`/`firstEnabledFilteredIndex()`, never a raw
   * disabled index.
   */
  function setActiveIndex(index: number): void {
    if (index < 0) commandList.resetActiveItem();
    else commandList.setActiveById(`${id}-option-${index}`);
  }

  /**
   * Moves the active option to the next/previous *enabled* option, wrapping
   * around. Disabled options are skipped entirely rather than becoming
   * active and dead-ending navigation (see `setActiveIndex`).
   */
  function moveActive(direction: 1 | -1): void {
    const indexes = enabledFilteredIndexes();
    if (indexes.length === 0) return;
    if (activeIndex < 0) {
      setActiveIndex(direction === 1 ? indexes[0]! : indexes.at(-1)!);
      return;
    }
    const currentPosition = indexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition < 0 ? 0 : (currentPosition + direction + indexes.length) % indexes.length;
    setActiveIndex(indexes[nextPosition]!);
  }

  /** Moves the active option to the first/last *enabled* option. */
  function moveToBoundary(direction: 'start' | 'end'): void {
    const indexes = enabledFilteredIndexes();
    setActiveIndex(
      indexes.length === 0 ? -1 : direction === 'start' ? indexes[0]! : indexes.at(-1)!,
    );
  }

  /** Live option-list registration so `commandList` can resolve `activeItemId` and scroll the active option into view. */
  $effect(() => {
    const listbox = listboxElement;
    if (!listbox || !listboxVisible) return;
    const optionNodes = listbox.querySelectorAll<HTMLElement>('[role="option"]');
    commandList.syncItems(
      filteredOptions.flatMap((option, index) => {
        const node = optionNodes[index];
        return node
          ? [
              {
                id: `${id}-option-${index}`,
                node,
                getValue: () => option.value,
                getOnselect: () => () => selectOption(option),
                getDisabled: () => !!option.disabled,
              },
            ]
          : [];
      }),
    );
  });

  $effect(() => {
    if (!listboxVisible) return;
    commandList.scrollActiveItemIntoView();
  });

  function findCommittedOption(rawValue: string): ComboboxOption<T> | undefined {
    const query = rawValue.trim();
    if (!query) return undefined;
    let labelMatch: ComboboxOption<T> | undefined;
    for (const option of options) {
      if (option.disabled) continue;
      if (option.value === query) return option;
      // Keep scanning after the first label match so an exact value match later
      // in the list still wins over a human-readable label collision.
      if (labelMatch === undefined && option.label === query) {
        labelMatch = option;
      }
    }
    return labelMatch;
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    textInputValue = target.value;
    open = true;
    setActiveIndex(firstEnabledFilteredIndex());
    hasExplicitNavigation = false;
  }

  function handleFocus() {
    if (!resolvedDisabled) open = true;
  }

  function handleBlur(event: FocusEvent) {
    // Defer close so a click on a listbox option can complete first. Use a DOM
    // containment check rather than a `#${listboxId}` selector so ids with
    // CSS-special characters (colons, dots, leading digits) don't throw.
    const next = event.relatedTarget as Node | null;
    if (next && listboxElement?.contains(next)) return;
    if (customValueAllowed && textInputValue.trim() && textInputValue !== committedLabel) {
      commitCustomValue();
      return;
    }
    open = false;
    // Restore the committed label if the live text drifted from it. Leaving the
    // field on a stale edit (without selecting an option) would desync the
    // visible text from the unchanged `value` — the same mismatch Escape fixes.
    if (textInputValue !== committedLabel) {
      textInputValue = committedLabel;
      if (inputElement) inputElement.value = committedLabel;
    }
  }

  function selectOption(option: ComboboxOption<T>) {
    if (option.disabled) return;
    hasUserCommittedValue = true;
    value = option.value;
    textInputValue = option.label;
    committedLabel = option.label;
    open = false;
    onchange?.(option.value);
  }

  function commitCustomValue(): void {
    const nextValue = textInputValue.trim();
    if (!customValueAllowed || !nextValue) return;
    if (
      options.some(
        (option) => option.disabled && (option.value === nextValue || option.label === nextValue),
      )
    ) {
      textInputValue = committedLabel;
      if (inputElement) inputElement.value = committedLabel;
      open = false;
      return;
    }
    hasUserCommittedValue = true;
    const matched = findCommittedOption(nextValue);
    const committedValue = matched?.value ?? nextValue;
    const committedText = matched?.label ?? nextValue;
    const previousValue = value;
    // This path only runs when arbitrary values are explicitly allowed.
    value = committedValue as T;
    textInputValue = committedText;
    committedLabel = committedText;
    open = false;
    if (committedValue !== previousValue) onchange?.(committedValue as T);
  }

  function resetToInitialValue(event: Event): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (event.defaultPrevented) return;
      // Use captured initialValue directly; don't fall back to defaultValue
      // because Svelte's reactive binding updates the attribute (and thus defaultValue).
      const resetValue = hasStoredInitialValue
        ? initialValue
        : customValueAllowed
          ? initialCustomValue || committedLabel
          : '';
      value = resetValue as T;
      const matched = options.find((option) => option.value === resetValue);
      const nextInputValue =
        matched?.label ?? (customValueAllowed ? resetValue : initialInputValue);
      textInputValue = nextInputValue;
      committedLabel = matched?.label ?? (customValueAllowed ? resetValue : '');
      open = false;
      commandList.resetActiveItem();
      if (inputElement) inputElement.value = nextInputValue;
      if (hiddenInputElement) hiddenInputElement.value = resetValue;
    }, 0);
  }

  $effect(() => {
    const input = hiddenInputElement;
    if (input === null) return;
    const form = input.form;
    form?.addEventListener('reset', resetToInitialValue);
    return () => {
      form?.removeEventListener('reset', resetToInitialValue);
      if (resetSyncTimeout !== undefined) {
        clearTimeout(resetSyncTimeout);
        resetSyncTimeout = undefined;
      }
    };
  });

  $effect(() => {
    inputElement?.setCustomValidity(
      (resolvedRequired && !value) || (!customValueAllowed && textInputValue !== committedLabel)
        ? 'Please select an option.'
        : '',
    );
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open = true;
      if (filteredOptions.length === 0) return;
      moveActive(1);
      hasExplicitNavigation = true;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      open = true;
      if (filteredOptions.length === 0) return;
      moveActive(-1);
      hasExplicitNavigation = true;
    } else if (event.key === 'Home') {
      if (!open) return;
      event.preventDefault();
      moveToBoundary('start');
      hasExplicitNavigation = true;
    } else if (event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      moveToBoundary('end');
      hasExplicitNavigation = true;
    } else if (event.key === 'Enter' && open) {
      const option = filteredOptions[activeIndex];
      if (customValueAllowed && !(hasExplicitNavigation && option)) {
        event.preventDefault();
        commitCustomValue();
      } else if (option) {
        event.preventDefault();
        selectOption(option);
      }
    } else if (event.key === 'Escape') {
      // Fallback path. In a real browser the capture-phase escape-stack listener
      // (installed by the $effect's pushEscapeHandler) runs first and has
      // already closed + restored + preventDefault'd; `defaultPrevented` is true
      // here and we bail. This branch only does real work when the stack
      // listener never ran — SSR/no-window environments where `window` is
      // absent so `pushEscapeHandler` installed nothing.
      if (event.defaultPrevented) return;
      handleEscape(event);
    }
  }
</script>

{#snippet comboboxControl()}
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
      disabled={resolvedDisabled}
      required={resolvedRequired}
      {placeholder}
      value={textInputValue}
      aria-autocomplete="list"
      aria-label={ariaLabel?.trim() || undefined}
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeOptionId}
      aria-invalid={field.ariaInvalid}
      aria-required={resolvedRequired || undefined}
      aria-describedby={describedBy}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
    />
  </div>

  {#if name}
    <input
      bind:this={hiddenInputElement}
      type="hidden"
      {name}
      {value}
      disabled={resolvedDisabled}
    />
  {/if}

  {#if listboxVisible}
    <Popover
      bind:open
      id={listboxId}
      triggerRef={inputElement}
      role="listbox"
      focusManagement="preserve"
      wireTriggerAria={false}
      closeOnEscape={false}
      widthMode="match-anchor"
      portalScopeClass={classNames('cinder-combobox', className)}
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
              // Disabled options are never active (see `setActiveIndex`) —
              // guard here so hovering one doesn't clear whatever option is
              // currently active via keyboard.
              if (option.disabled) return;
              setActiveIndex(index);
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

  {#if emptyVisible}
    <Popover
      bind:open
      id={listboxId}
      triggerRef={inputElement}
      role="listbox"
      focusManagement="preserve"
      wireTriggerAria={false}
      closeOnEscape={false}
      widthMode="match-anchor"
      portalScopeClass={classNames('cinder-combobox', className)}
      class="cinder-combobox__empty-panel"
    >
      <div
        class="cinder-combobox__empty"
        role="option"
        aria-disabled="true"
        aria-selected="false"
        data-cinder-active
      >
        No results
      </div>
    </Popover>
  {/if}

  <!-- Keep the live region mounted while the visible empty-state surface uses
       the same portal and Floating UI path as the options panel. -->
  <div class="cinder-combobox__empty-status" role="status">
    {emptyVisible ? 'No results' : ''}
  </div>
{/snippet}

<!-- The error node stays mounted (errorAlwaysMounted) so the live region is
     registered before text is injected; freshly-mounted aria-live nodes are
     not reliably announced by NVDA/JAWS. -->
<FormFieldFrame
  {id}
  {label}
  {description}
  {error}
  required={resolvedRequired}
  disabled={resolvedDisabled}
  class={classNames('cinder-combobox', className)}
  labelClass="cinder-combobox__label"
  descriptionClass="cinder-combobox__description"
  errorClass="cinder-combobox__error"
  {descriptionId}
  errorId={field.ownErrorId ?? stableLocalErrorId}
  errorAlwaysMounted
  control={comboboxControl}
/>
