<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Multi-value dropdown with checkbox options, optional filtering, and count-summary trigger text.
   * @tag form
   * @tag selection
   * @tag multiselect
   * @useWhen Selecting multiple values from a fixed option list while preserving compact form layout.
   * @useWhen Showing many options in an anchored picker instead of a permanently-expanded checkbox group.
   * @avoidWhen Selecting a single value from a short fixed list — use select instead.
   * @avoidWhen Moving items between available/selected panes — use transfer-list instead.
   * @related select, combobox, checkbox-group, transfer-list
   */
  export type {
    MultiSelectDirection,
    MultiSelectItem,
    MultiSelectProps,
    MultiSelectSelectionFeedback,
  } from './multi-select.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import { tick, untrack } from 'svelte';

  import { createCommandListState } from '../_internal/create-command-list-state.svelte.ts';
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { MultiSelectItem, MultiSelectProps } from './multi-select.types.ts';

  let {
    id,
    items,
    selectedIds = $bindable([] as NoInfer<T>[]),
    name,
    label,
    placeholder = 'Select options',
    description,
    error,
    warning,
    disabled,
    readonly = false,
    required,
    filterable = false,
    filter,
    selectionFeedback = 'fixed',
    direction = 'down',
    class: className,
    'aria-describedby': consumerDescribedBy,
  }: MultiSelectProps<T> = $props();

  const context = getFormFieldContext();
  const warningId = $derived(warning ? `${id}-warning` : undefined);
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'multi-select',
      consumerDescribedBy,
      additionalDescribedBy: [warningId],
      required,
      disabled,
    }),
  );

  const stableLocalErrorId = $derived(
    context?.errorId === `${field.id}-error`
      ? `${field.id}-multi-select-error`
      : `${field.id}-error`,
  );

  const listboxId = $derived(`${id}-listbox`);
  const filterId = $derived(`${id}-filter`);
  const filterLabelHintId = $derived(`${id}-filter-label-hint`);
  const labelId = $derived(label ? `${id}-label` : undefined);
  const listboxLabelledBy = $derived(labelId ?? context?.labelId);
  const itemIdSet = $derived(new Set(items.map((item) => item.id)));
  const uniqueSelectedIds = $derived.by(() => {
    const seen = new Set<T>();
    const next: T[] = [];
    for (const selectedId of selectedIds) {
      if (!itemIdSet.has(selectedId) || seen.has(selectedId)) continue;
      seen.add(selectedId);
      next.push(selectedId);
    }
    return next;
  });
  const selectedSet = $derived(new Set(uniqueSelectedIds));
  const selectedCount = $derived(uniqueSelectedIds.length);
  let open = $state(false);
  let query = $state('');
  let reorderAfterReopen = $state(false);
  let openedAtLeastOnce = $state(false);
  let triggerElement = $state<HTMLButtonElement | null>(null);
  let controlElement = $state<HTMLDivElement | null>(null);
  let panelElement = $state<HTMLDivElement | null>(null);
  let filterElement = $state<HTMLInputElement | null>(null);
  let listboxElement = $state<HTMLElement | null>(null);
  let validityProxyElement = $state<HTMLInputElement | null>(null);
  let nativeError = $state('');
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  const triggerAriaInvalid = $derived(field.ariaInvalid ?? (nativeError ? true : undefined));
  const triggerDescribedBy = $derived.by(() => {
    const ids = new Set((field.describedBy ?? '').split(/\s+/).filter(Boolean));
    if (nativeError) ids.add(field.ownErrorId ?? stableLocalErrorId);
    const value = Array.from(ids).join(' ');
    return value === '' ? undefined : value;
  });
  const filterAriaLabelledBy = $derived.by(() => {
    if (!listboxLabelledBy) return filterLabelHintId;
    return `${listboxLabelledBy} ${filterLabelHintId}`;
  });
  const triggerSummary = $derived(selectedCount > 0 ? `${selectedCount} selected` : placeholder);
  const emptyListMessage = $derived(filterable ? 'No matching options' : 'No options');
  const initialSelectedIds = untrack(() => [...selectedIds]);
  const commandList = createCommandListState(() => listboxId);

  const defaultFilter = (item: MultiSelectItem<T>, nextQuery: string): boolean => {
    if (!nextQuery) return true;
    const q = nextQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false)
    );
  };

  const filteredItems = $derived.by(() => {
    if (!filterable) return items;
    const fn = filter ?? defaultFilter;
    return items.filter((item) => fn(item, query));
  });

  const visibleItems = $derived.by(() => {
    const shouldPromoteSelected =
      selectionFeedback === 'top' ||
      (selectionFeedback === 'top-after-reopen' && reorderAfterReopen);

    if (!shouldPromoteSelected) return filteredItems;

    const selected: MultiSelectItem<T>[] = [];
    const unselected: MultiSelectItem<T>[] = [];
    for (const item of filteredItems) {
      if (selectedSet.has(item.id)) selected.push(item);
      else unselected.push(item);
    }
    return [...selected, ...unselected];
  });

  const activeOptionId = $derived(open ? (commandList.activeItemId ?? undefined) : undefined);
  const activeIndex = $derived(
    commandList.activeItemId === null
      ? -1
      : visibleItems.findIndex((_, index) => `${id}-option-${index}` === commandList.activeItemId),
  );

  function firstEnabledIndex(list: readonly MultiSelectItem<T>[]): number {
    return list.findIndex((item) => !item.disabled);
  }

  function getLastEnabledIndex(list: readonly MultiSelectItem<T>[]): number {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!list[index]?.disabled) return index;
    }
    return -1;
  }

  function openMenu(preferLast = false): void {
    if (field.disabled) return;
    open = true;
    query = '';
    reorderAfterReopen = selectionFeedback === 'top-after-reopen' && openedAtLeastOnce;
    openedAtLeastOnce = true;
    void tick().then(() => {
      const nextIndex = preferLast
        ? getLastEnabledIndex(visibleItems)
        : firstEnabledIndex(visibleItems);
      if (nextIndex >= 0) commandList.setActiveById(`${id}-option-${nextIndex}`);
      if (filterable) filterElement?.focus();
      else listboxElement?.focus();
    });
  }

  function closeMenu(restoreFocus = true): void {
    open = false;
    query = '';
    if (restoreFocus) triggerElement?.focus();
  }

  function setSelectedIds(next: T[]): void {
    selectedIds = [...next];
  }

  function toggleItem(item: MultiSelectItem<T>): void {
    if (field.disabled || readonly || item.disabled) return;
    const nextSelectedIds = selectedSet.has(item.id)
      ? uniqueSelectedIds.filter((candidate) => candidate !== item.id)
      : [...uniqueSelectedIds, item.id];
    setSelectedIds(nextSelectedIds);
    if (!open) return;
    queueMicrotask(() => {
      const nextIndex = visibleItems.findIndex((candidate) => candidate.id === item.id);
      if (nextIndex >= 0) commandList.setActiveById(`${id}-option-${nextIndex}`);
    });
  }

  function clearSelection(event?: Event): void {
    event?.stopPropagation();
    if (field.disabled || readonly || selectedIds.length === 0) return;
    setSelectedIds([]);
    triggerElement?.focus();
  }

  function handleListNavigationKeydown(event: KeyboardEvent): void {
    commandList.handleKeydown({
      event,
      onEnter: (itemId) => {
        const index = visibleItems.findIndex(
          (_, candidateIndex) => `${id}-option-${candidateIndex}` === itemId,
        );
        const item = visibleItems[index];
        if (item) toggleItem(item);
      },
      onEscape: closeMenu,
      preventDefaultOnEmptyEnter: true,
    });
    if (event.key === ' ') {
      event.preventDefault();
      const item = visibleItems[activeIndex];
      if (item) toggleItem(item);
    }
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (field.disabled) return;
    if ((event.key === 'Enter' || event.key === ' ') && !open) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openMenu();
      else commandList.handleKeydown({ event });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openMenu(true);
      else commandList.handleKeydown({ event });
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedIds.length > 0) {
      clearSelection(event);
    }
  }

  function handleFilterInput(event: Event): void {
    query = (event.currentTarget as HTMLInputElement).value;
  }

  function handleFilterKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === ' ') return;
    if (event.key === 'Home' || event.key === 'End') return;
    handleListNavigationKeydown(event);
  }

  function resetToInitialValue(event: Event): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (event.defaultPrevented) return;
      setSelectedIds(initialSelectedIds);
      open = false;
      query = '';
    }, 0);
  }

  function handleProxyInvalid(event: Event): void {
    event.preventDefault();
    nativeError =
      validityProxyElement?.validationMessage ||
      (validityProxyElement?.validity.valueMissing ? 'Please select at least one option.' : '');
    triggerElement?.focus();
  }

  $effect(() => {
    const proxy = validityProxyElement;
    if (!proxy) return;
    proxy.setCustomValidity(
      field.required && uniqueSelectedIds.length === 0 ? 'Please select at least one option.' : '',
    );
    if (proxy.validationMessage === '') nativeError = '';
  });

  $effect(() => {
    const proxy = validityProxyElement;
    if (proxy === null) return;
    const form = proxy.form;
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
    const listbox = listboxElement;
    if (!listbox) return;
    commandList.syncItems(
      visibleItems.flatMap((item, index) => {
        const node = listbox.querySelectorAll<HTMLElement>('[role="option"]')[index];
        return node
          ? [
              {
                id: `${id}-option-${index}`,
                node,
                getValue: () => item.id,
                getOnselect: () => () => toggleItem(item),
                getDisabled: () => !!item.disabled,
              },
            ]
          : [];
      }),
    );
  });

  $effect(() => {
    if (!open) return;
    return commandList.bindDismissal({
      isOpen: () => open,
      isInside: (target) => !!controlElement?.contains(target) || !!panelElement?.contains(target),
      onDismiss: closeMenu,
    });
  });

  $effect(() => {
    if (!open) return;
    commandList.scrollActiveItemIntoView();
  });
</script>

<div class={classNames('cinder-multi-select', className)}>
  {#if label}
    <label
      id={labelId}
      for={id}
      class="cinder-multi-select__label"
      data-disabled={field.disabled || undefined}
    >
      {label}
      {#if field.required}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  <div bind:this={controlElement} class="cinder-multi-select__control">
    <!-- svelte-ignore a11y_role_supports_aria_props_implicit (the focusable picker trigger intentionally mirrors invalid state for assistive tech) -->
    <button
      bind:this={triggerElement}
      type="button"
      {id}
      class="cinder-_input-frame cinder-multi-select__trigger"
      disabled={field.disabled}
      aria-invalid={triggerAriaInvalid}
      aria-describedby={triggerDescribedBy}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      data-cinder-invalid={triggerAriaInvalid ? 'true' : undefined}
      data-cinder-open={open || undefined}
      data-cinder-has-clear={(selectedCount > 0 && !field.disabled && !readonly) || undefined}
      data-cinder-readonly={readonly || undefined}
      onclick={() => (open ? closeMenu() : openMenu())}
      onkeydown={handleTriggerKeydown}
    >
      <span class="cinder-multi-select__summary cinder-_truncate">{triggerSummary}</span>
      {#if selectedCount > 0}
        <span class="cinder-multi-select__count" aria-hidden="true">{selectedCount}</span>
      {/if}
      <span class="cinder-multi-select__chevron" aria-hidden="true">
        <ChevronDown size={16} strokeWidth={2} />
      </span>
    </button>

    {#if selectedCount > 0 && !field.disabled && !readonly}
      <button
        type="button"
        class="cinder-multi-select__clear"
        aria-label="Clear selected items"
        onclick={clearSelection}
      >
        ×
      </button>
    {/if}

    {#if open}
      <div
        bind:this={panelElement}
        id={`${id}-popover`}
        class="cinder-_floating-surface cinder-multi-select__panel"
        data-cinder-direction={direction}
        data-cinder-open
      >
        {#if filterable}
          <input
            bind:this={filterElement}
            id={filterId}
            class="cinder-_input-frame cinder-multi-select__filter"
            type="text"
            role="combobox"
            placeholder="Filter options"
            value={query}
            aria-labelledby={filterAriaLabelledBy}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-readonly={readonly || undefined}
            {readonly}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            oninput={handleFilterInput}
            onkeydown={handleFilterKeydown}
          />
        {/if}
        <ul
          bind:this={listboxElement}
          id={listboxId}
          role="listbox"
          class="cinder-multi-select__listbox"
          aria-multiselectable="true"
          aria-labelledby={listboxLabelledBy}
          aria-label={listboxLabelledBy ? undefined : 'Options'}
          aria-required={field.required || undefined}
          aria-readonly={readonly || undefined}
          aria-activedescendant={filterable ? undefined : activeOptionId}
          tabindex={filterable ? -1 : 0}
          onkeydown={handleListNavigationKeydown}
        >
          {#each visibleItems as item, index (item.id)}
            <li
              id="{id}-option-{index}"
              role="option"
              class="cinder-_option-row cinder-multi-select__option"
              aria-selected={selectedSet.has(item.id)}
              aria-disabled={item.disabled || undefined}
              data-cinder-active={activeIndex === index || undefined}
              onmousedown={(event) => {
                event.preventDefault();
                if (item.disabled) return;
                commandList.setActiveById(`${id}-option-${index}`);
                toggleItem(item);
              }}
              onmouseenter={() => {
                if (item.disabled) return;
                commandList.setActiveById(`${id}-option-${index}`);
              }}
            >
              <span class="cinder-checkbox-field__control cinder-multi-select__checkbox-indicator">
                <span
                  class="cinder-checkbox cinder-multi-select__checkbox-box"
                  data-cinder-checked={selectedSet.has(item.id) || undefined}
                  data-cinder-disabled={field.disabled || readonly || item.disabled || undefined}
                  aria-hidden="true"
                ></span>
                <span class="cinder-checkbox-field__indicator" aria-hidden="true"></span>
              </span>
              <span class="cinder-multi-select__option-text">
                <span class="cinder-multi-select__option-label">{item.label}</span>
                {#if item.description}
                  <span class="cinder-multi-select__option-description">{item.description}</span>
                {/if}
              </span>
            </li>
          {:else}
            <li
              class="cinder-multi-select__empty"
              role="option"
              aria-disabled="true"
              aria-selected="false"
            >
              {emptyListMessage}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if filterable}
    <p class="cinder-multi-select__sr-status" role="status" aria-live="polite">
      {open && visibleItems.length === 0 ? emptyListMessage : ''}
    </p>
    <span id={filterLabelHintId} class="cinder-multi-select__sr-status">Filter options</span>
  {/if}

  <input
    bind:this={validityProxyElement}
    type="text"
    tabindex="-1"
    aria-hidden="true"
    class="cinder-multi-select__validation-proxy"
    value={selectedCount > 0 ? 'selected' : ''}
    required={field.required}
    disabled={field.disabled}
    oninvalid={handleProxyInvalid}
  />

  {#if name}
    {#each uniqueSelectedIds as selectedId (selectedId)}
      <input type="hidden" {name} value={selectedId} disabled={field.disabled} />
    {/each}
  {/if}

  {#if description}
    <p id={field.ownDescriptionId} class="cinder-multi-select__description">{description}</p>
  {/if}

  {#if warning}
    <p id={warningId} class="cinder-multi-select__warning">{warning}</p>
  {/if}

  <p
    id={field.ownErrorId ?? stableLocalErrorId}
    class="cinder-multi-select__error"
    aria-live="polite"
    data-cinder-error={!!error || !!nativeError || undefined}
  >
    {error ?? nativeError}
  </p>
</div>
