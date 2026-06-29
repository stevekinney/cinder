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
  import { tick, untrack } from 'svelte';

  import { pushEscapeHandler } from '../../_internal/overlay.ts';
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
    filterItem,
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
  const labelId = $derived(label ? `${id}-label` : undefined);
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
  const triggerSummary = $derived(selectedCount > 0 ? `${selectedCount} selected` : placeholder);
  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(-1);
  let reorderAfterReopen = $state(false);
  let openedAtLeastOnce = $state(false);
  let triggerElement = $state<HTMLButtonElement | null>(null);
  let controlElement = $state<HTMLDivElement | null>(null);
  let filterElement = $state<HTMLInputElement | null>(null);
  let listboxElement = $state<HTMLElement | null>(null);
  let panelElement = $state<HTMLDivElement | null>(null);
  let validityProxyElement = $state<HTMLInputElement | null>(null);
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  const initialSelectedIds = untrack(() => [...selectedIds]);

  const defaultFilter = (item: MultiSelectItem<T>, nextQuery: string): boolean => {
    if (!nextQuery) return true;
    const q = nextQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false)
    );
  };

  const filteredItems = $derived.by(() => {
    if (!filterable) return items;
    const fn = filterItem ?? defaultFilter;
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

  const activeOptionId = $derived(
    activeIndex >= 0 && activeIndex < visibleItems.length
      ? `${id}-option-${activeIndex}`
      : undefined,
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
    const nextIndex = preferLast
      ? getLastEnabledIndex(visibleItems)
      : firstEnabledIndex(visibleItems);
    activeIndex = nextIndex;
    void tick().then(() => {
      if (filterable) filterElement?.focus();
      else listboxElement?.focus();
    });
  }

  function closeMenu(restoreFocus = true): void {
    open = false;
    activeIndex = -1;
    query = '';
    if (restoreFocus) triggerElement?.focus();
  }

  function setSelectedIds(next: T[]): void {
    selectedIds = [...next];
  }

  function toggleItem(item: MultiSelectItem<T>): void {
    if (field.disabled || readonly || item.disabled) return;
    const nextSelectedIds = selectedSet.has(item.id)
      ? selectedIds.filter((candidate) => candidate !== item.id)
      : [...selectedIds, item.id];
    setSelectedIds(nextSelectedIds);
    if (!open) return;
    queueMicrotask(() => {
      const nextIndex = visibleItems.findIndex((candidate) => candidate.id === item.id);
      if (nextIndex >= 0) activeIndex = nextIndex;
    });
  }

  function clearSelection(event?: Event): void {
    event?.stopPropagation();
    if (field.disabled || readonly || selectedIds.length === 0) return;
    setSelectedIds([]);
  }

  function moveActive(delta: 1 | -1): void {
    if (visibleItems.length === 0) {
      activeIndex = -1;
      return;
    }
    const start = activeIndex < 0 ? (delta === 1 ? -1 : 0) : activeIndex;
    for (let offset = 1; offset <= visibleItems.length; offset += 1) {
      const index = (start + delta * offset + visibleItems.length) % visibleItems.length;
      if (!visibleItems[index]?.disabled) {
        activeIndex = index;
        return;
      }
    }
  }

  function handleListNavigationKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = firstEnabledIndex(visibleItems);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      activeIndex = getLastEnabledIndex(visibleItems);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const item = visibleItems[activeIndex];
      if (!item) return;
      toggleItem(item);
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
      else moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openMenu(true);
      else moveActive(-1);
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedIds.length > 0) {
      clearSelection(event);
    }
  }

  function handleFilterInput(event: Event): void {
    query = (event.currentTarget as HTMLInputElement).value;
    activeIndex = firstEnabledIndex(visibleItems);
  }

  function handleFilterKeydown(event: KeyboardEvent): void {
    if (event.key === ' ') return;
    handleListNavigationKeydown(event);
  }

  function resetToInitialValue(event: Event): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (event.defaultPrevented) return;
      setSelectedIds(initialSelectedIds);
      open = false;
      activeIndex = -1;
      query = '';
    }, 0);
  }

  function handleProxyInvalid(event: Event): void {
    event.preventDefault();
    triggerElement?.focus();
  }

  $effect(() => {
    const proxy = validityProxyElement;
    if (!proxy) return;
    proxy.setCustomValidity(
      field.required && uniqueSelectedIds.length === 0 ? 'Please select at least one option.' : '',
    );
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
    if (!open) return;
    if (
      activeIndex < 0 ||
      activeIndex >= visibleItems.length ||
      visibleItems[activeIndex]?.disabled
    ) {
      activeIndex = firstEnabledIndex(visibleItems);
    }
  });

  $effect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && controlElement?.contains(target)) return;
      closeMenu(false);
    };

    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target as Node | null;
      if (target && controlElement?.contains(target)) return;
      closeMenu(false);
    };

    const releaseEscape = pushEscapeHandler((event?: KeyboardEvent) => {
      if (event?.key === 'Escape') {
        event?.preventDefault();
        closeMenu();
      }
    });

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      releaseEscape();
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
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
    <button
      bind:this={triggerElement}
      type="button"
      {id}
      class="cinder-_input-frame cinder-multi-select__trigger"
      disabled={field.disabled}
      aria-invalid={field.ariaInvalid}
      aria-describedby={field.describedBy}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-required={field.required || undefined}
      data-cinder-open={open || undefined}
      data-cinder-readonly={readonly || undefined}
      onclick={() => (open ? closeMenu() : openMenu())}
      onkeydown={handleTriggerKeydown}
    >
      <span class="cinder-multi-select__summary cinder-_truncate">{triggerSummary}</span>
      {#if selectedCount > 0}
        <span class="cinder-multi-select__count" aria-hidden="true">{selectedCount}</span>
      {/if}
      <span class="cinder-multi-select__chevron" aria-hidden="true">▾</span>
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
            aria-label="Filter options"
            aria-haspopup="listbox"
            aria-expanded={open}
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
          aria-labelledby={labelId}
          aria-label={label ? undefined : 'Options'}
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
                activeIndex = index;
                toggleItem(item);
              }}
              onmouseenter={() => {
                if (item.disabled) return;
                activeIndex = index;
              }}
            >
              <span class="cinder-multi-select__checkbox" aria-hidden="true">
                {#if selectedSet.has(item.id)}✓{/if}
              </span>
              <span class="cinder-multi-select__option-text">
                <span class="cinder-multi-select__option-label">{item.label}</span>
                {#if item.description}
                  <span class="cinder-multi-select__option-description">{item.description}</span>
                {/if}
              </span>
            </li>
          {:else}
            <li class="cinder-multi-select__empty" role="option" aria-disabled="true">
              No matching options
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

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
    data-cinder-error={!!error || undefined}
  >
    {error ?? ''}
  </p>
</div>
