<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Compact multi-select assignment control for choosing a subset from a fixed item pool.
   * @tag form
   * @tag selection
   * @useWhen Letting users choose permissions, tags, or visible columns from a fixed pool.
   * @avoidWhen The pool needs inline search or filtering — compose search controls around the list instead.
   * @avoidWhen The user only needs independent checkbox choices — use checkbox-group instead. | checkbox-group
   * @related checkbox-group, selection-popover, sortable-list
   */
  export type { TransferListItem, TransferListProps } from './transfer-list.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';

  import { classNames } from '../../utilities/class-names.ts';
  import { overflowShadow } from '../../utilities/attachments.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import type { TransferListItem, TransferListProps } from './transfer-list.types.ts';

  const baseId = $props.id();

  let {
    items,
    value = $bindable([]),
    leftLabel = 'Available',
    rightLabel = 'Selected',
    onValueChange,
    class: customClassName,
    ...rest
  }: TransferListProps = $props();

  let activeId = $state<string | null>(null);
  let listElement: HTMLUListElement | undefined = $state();
  const announcer = useAnnouncer({ clearDelay: 5000 });

  const uniqueItems = $derived.by(() => {
    const seenIds = new SvelteSet<string>();
    return items.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  });
  const itemById = $derived.by(() => new Map(uniqueItems.map((item) => [item.id, item])));
  const knownValue = $derived.by(() => {
    const seenIds = new SvelteSet<string>();
    return value.filter((id) => {
      if (!itemById.has(id) || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
  });
  const selectedIds = $derived(new Set(knownValue));
  const selectedCount = $derived(knownValue.length);
  const activeOptionId = $derived.by(() => {
    if (!activeId) return undefined;
    const index = uniqueItems.findIndex((item) => item.id === activeId);
    return index === -1 ? undefined : `${baseId}-option-${index}`;
  });

  function optionId(index: number): string {
    return `${baseId}-option-${index}`;
  }

  function isSelectable(item: TransferListItem): boolean {
    return selectedIds.has(item.id) || !item.disabled;
  }

  function enabledItems(): TransferListItem[] {
    return uniqueItems.filter(isSelectable);
  }

  function resolveActiveId(currentId: string | null): string | null {
    const enabled = enabledItems();
    if (enabled.length === 0) return null;
    if (currentId && enabled.some((item) => item.id === currentId)) return currentId;
    return enabled[0]?.id ?? null;
  }

  function announceSelection(item: TransferListItem, selected: boolean): void {
    announcer.announce(
      `${item.label} ${selected ? 'added to' : 'removed from'} ${rightLabel}. ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'} selected.`,
    );
  }

  function commitSelection(id: string): void {
    const item = itemById.get(id);
    if (!item || !isSelectable(item)) return;
    const selected = selectedIds.has(id);
    const nextValue = selected
      ? knownValue.filter((valueId) => valueId !== id)
      : [...knownValue, id];
    value = nextValue;
    onValueChange?.(nextValue);
    announceSelection(item, !selected);
  }

  function handleOptionClick(item: TransferListItem): void {
    if (!isSelectable(item)) return;
    activeId = item.id;
    commitSelection(item.id);
    listElement?.focus();
  }

  function handleListFocus(): void {
    activeId = resolveActiveId(activeId);
  }

  async function handleListKeydown(event: KeyboardEvent): Promise<void> {
    const enabled = enabledItems();
    const currentId = resolveActiveId(activeId);
    if (enabled.length === 0 || !currentId) return;
    const currentIndex = enabled.findIndex((item) => item.id === currentId);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeId = enabled[(currentIndex + direction + enabled.length) % enabled.length]?.id ?? null;
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      activeId = event.key === 'Home' ? (enabled[0]?.id ?? null) : (enabled.at(-1)?.id ?? null);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      commitSelection(currentId);
      await tick();
    }
  }
</script>

<div {...rest} class={classNames('cinder-transfer-list', customClassName)}>
  <div class="cinder-transfer-list__header">
    <h3 id={`${baseId}-label`} class="cinder-transfer-list__label">{leftLabel}</h3>
    <span class="cinder-transfer-list__count" aria-live="polite">
      {selectedCount}
      {selectedCount === 1 ? 'item' : 'items'}
      {rightLabel.toLowerCase()}
    </span>
  </div>
  <ul
    bind:this={listElement}
    class="cinder-transfer-list__list"
    role="listbox"
    aria-multiselectable="true"
    aria-labelledby={`${baseId}-label`}
    aria-activedescendant={activeOptionId}
    tabindex="0"
    onfocus={handleListFocus}
    onkeydown={handleListKeydown}
    {@attach overflowShadow('block')}
  >
    {#each uniqueItems as item, index (item.id)}
      <li
        id={optionId(index)}
        class="cinder-_option-row cinder-transfer-list__option"
        role="option"
        aria-selected={selectedIds.has(item.id) ? 'true' : 'false'}
        aria-disabled={!isSelectable(item) ? 'true' : undefined}
        data-cinder-active={activeId === item.id ? 'true' : undefined}
        data-cinder-transfer-list-item-id={item.id}
        onclick={() => handleOptionClick(item)}
        onkeydown={(event) => {
          event.stopPropagation();
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            handleOptionClick(item);
          }
        }}
      >
        <span>{item.label}</span>
        {#if selectedIds.has(item.id)}
          <span class="cinder-transfer-list__status" aria-hidden="true">Selected</span>
        {/if}
      </li>
    {:else}
      <li class="cinder-transfer-list__empty" role="presentation">No items</li>
    {/each}
  </ul>
  <div role="alert" aria-atomic="true" class="cinder-sr-only">{announcer.message}</div>
</div>
