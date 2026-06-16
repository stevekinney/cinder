<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Dual-list assignment control for moving items between an available pool and a selected set.
   * @tag form
   * @tag selection
   * @useWhen Letting users build a subset from a fixed pool such as permissions, tags, or visible columns.
   * @avoidWhen The pool needs inline search or filtering - compose search controls around the lists instead.
   * @avoidWhen The user only needs independent checkbox choices - use checkbox-group instead. | checkbox-group
   * @related checkbox-group, selection-popover, sortable-list
   */
  export type { TransferListItem, TransferListProps } from './transfer-list.types.ts';
</script>

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import { classNames } from '../../utilities/class-names.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import type { TransferListItem, TransferListProps } from './transfer-list.types.ts';

  const baseId = $props.id();

  let {
    items,
    value = $bindable([]),
    leftLabel = 'Available',
    rightLabel = 'Selected',
    onChange,
    class: customClassName,
    ...rest
  }: TransferListProps = $props();

  let leftSelectedIds = $state<string[]>([]);
  let rightSelectedIds = $state<string[]>([]);
  let leftActiveId = $state<string | null>(null);
  let rightActiveId = $state<string | null>(null);

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
  const knownValue = $derived(value.filter((id) => itemById.has(id)));
  const rightIdSet = $derived(new Set(knownValue));
  const leftItems = $derived(uniqueItems.filter((item) => !rightIdSet.has(item.id)));
  const rightItems = $derived(
    knownValue.flatMap((id) => {
      const item = itemById.get(id);
      return item ? [item] : [];
    }),
  );
  const leftItemIdSet = $derived(new Set(leftItems.map((item) => item.id)));
  const rightItemIdSet = $derived(new Set(rightItems.map((item) => item.id)));

  const leftSelectedSet = $derived(new Set(leftSelectedIds));
  const rightSelectedSet = $derived(new Set(rightSelectedIds));

  const movableLeftSelectedIds = $derived(
    leftSelectedIds.filter((id) => {
      const item = itemById.get(id);
      return item !== undefined && !item.disabled && !rightIdSet.has(id);
    }),
  );
  const movableRightSelectedIds = $derived(
    rightSelectedIds.filter((id) => {
      const item = itemById.get(id);
      return item !== undefined && !item.disabled && rightIdSet.has(id);
    }),
  );
  const movableLeftItemIds = $derived(
    leftItems.filter((item) => !item.disabled).map((item) => item.id),
  );
  const movableRightItemIds = $derived(
    rightItems.filter((item) => !item.disabled).map((item) => item.id),
  );

  function optionId(side: 'left' | 'right', index: number): string {
    return `${baseId}-${side}-option-${index}`;
  }

  function getEnabledItems(sideItems: TransferListItem[]): TransferListItem[] {
    return sideItems.filter((item) => !item.disabled);
  }

  function resolveActiveId(sideItems: TransferListItem[], currentId: string | null): string | null {
    const enabled = getEnabledItems(sideItems);
    if (enabled.length === 0) return null;
    if (currentId && enabled.some((item) => item.id === currentId)) return currentId;
    return enabled[0]?.id ?? null;
  }

  const resolvedLeftActiveId = $derived(resolveActiveId(leftItems, leftActiveId));
  const resolvedRightActiveId = $derived(resolveActiveId(rightItems, rightActiveId));

  $effect(() => {
    const nextLeftSelectedIds = leftSelectedIds.filter((id) => leftItemIdSet.has(id));
    const nextRightSelectedIds = rightSelectedIds.filter((id) => rightItemIdSet.has(id));

    if (nextLeftSelectedIds.length !== leftSelectedIds.length) {
      leftSelectedIds = nextLeftSelectedIds;
    }

    if (nextRightSelectedIds.length !== rightSelectedIds.length) {
      rightSelectedIds = nextRightSelectedIds;
    }
  });

  const leftActiveOptionId = $derived.by(() => {
    if (!resolvedLeftActiveId) return undefined;
    const index = leftItems.findIndex((item) => item.id === resolvedLeftActiveId);
    return index === -1 ? undefined : optionId('left', index);
  });

  const rightActiveOptionId = $derived.by(() => {
    if (!resolvedRightActiveId) return undefined;
    const index = rightItems.findIndex((item) => item.id === resolvedRightActiveId);
    return index === -1 ? undefined : optionId('right', index);
  });

  function commitValue(nextValue: string[], announcement: string): void {
    const dedupedKnownValue = [...new Set(nextValue)].filter((id) => itemById.has(id));
    value = dedupedKnownValue;
    onChange?.(dedupedKnownValue);
    announcer.announce(announcement);
  }

  function pluralize(count: number): string {
    return count === 1 ? 'item' : 'items';
  }

  function moveSelectedRight(): void {
    if (movableLeftSelectedIds.length === 0) return;
    commitValue(
      [...knownValue, ...movableLeftSelectedIds],
      `${movableLeftSelectedIds.length} ${pluralize(movableLeftSelectedIds.length)} moved to ${rightLabel}.`,
    );
    leftSelectedIds = [];
  }

  function moveAllRight(): void {
    if (movableLeftItemIds.length === 0) return;
    commitValue(
      [...knownValue, ...movableLeftItemIds],
      `${movableLeftItemIds.length} ${pluralize(movableLeftItemIds.length)} moved to ${rightLabel}.`,
    );
    leftSelectedIds = [];
  }

  function moveSelectedLeft(): void {
    if (movableRightSelectedIds.length === 0) return;
    const removing = new Set(movableRightSelectedIds);
    commitValue(
      knownValue.filter((id) => !removing.has(id)),
      `${movableRightSelectedIds.length} ${pluralize(movableRightSelectedIds.length)} moved to ${leftLabel}.`,
    );
    rightSelectedIds = [];
  }

  function moveAllLeft(): void {
    if (movableRightItemIds.length === 0) return;
    const removing = new Set(movableRightItemIds);
    commitValue(
      knownValue.filter((id) => !removing.has(id)),
      `${movableRightItemIds.length} ${pluralize(movableRightItemIds.length)} moved to ${leftLabel}.`,
    );
    rightSelectedIds = [];
  }

  function toggleId(side: 'left' | 'right', id: string): void {
    const item = itemById.get(id);
    if (!item || item.disabled) return;

    if (side === 'left') {
      leftSelectedIds = leftSelectedSet.has(id)
        ? leftSelectedIds.filter((selectedId) => selectedId !== id)
        : [...leftSelectedIds, id];
      return;
    }

    rightSelectedIds = rightSelectedSet.has(id)
      ? rightSelectedIds.filter((selectedId) => selectedId !== id)
      : [...rightSelectedIds, id];
  }

  function setActiveId(side: 'left' | 'right', id: string | null): void {
    if (side === 'left') leftActiveId = id;
    else rightActiveId = id;
  }

  function handleOptionClick(side: 'left' | 'right', item: TransferListItem): void {
    if (item.disabled) return;
    setActiveId(side, item.id);
    toggleId(side, item.id);
  }

  function handleListClick(event: MouseEvent, side: 'left' | 'right'): void {
    const target = event.target instanceof Element ? event.target : null;
    const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!target || !currentTarget) return;

    const optionElement = target.closest<HTMLElement>('[data-cinder-transfer-list-item-id]');
    if (!optionElement || !currentTarget.contains(optionElement)) return;

    const id = optionElement.getAttribute('data-cinder-transfer-list-item-id');
    if (!id) return;

    const item = itemById.get(id);
    if (!item) return;

    handleOptionClick(side, item);
  }

  function handleListFocus(side: 'left' | 'right'): void {
    if (side === 'left') {
      leftActiveId = resolvedLeftActiveId;
    } else {
      rightActiveId = resolvedRightActiveId;
    }
  }

  function handleListKeydown(event: KeyboardEvent, side: 'left' | 'right'): void {
    const sideItems = side === 'left' ? leftItems : rightItems;
    const activeId = side === 'left' ? resolvedLeftActiveId : resolvedRightActiveId;
    const enabledItems = getEnabledItems(sideItems);
    if (enabledItems.length === 0 || !activeId) return;

    const activeIndex = enabledItems.findIndex((item) => item.id === activeId);
    if (activeIndex === -1) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (activeIndex + direction + enabledItems.length) % enabledItems.length;
      setActiveId(side, enabledItems[nextIndex]?.id ?? null);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveId(
        side,
        event.key === 'Home'
          ? (enabledItems[0]?.id ?? null)
          : (enabledItems[enabledItems.length - 1]?.id ?? null),
      );
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      toggleId(side, activeId);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (side === 'left') moveSelectedRight();
      else moveSelectedLeft();
    }
  }
</script>

<div {...rest} class={classNames('cinder-transfer-list', customClassName)}>
  <section class="cinder-transfer-list__panel" aria-labelledby={`${baseId}-left-label`}>
    <h3 id={`${baseId}-left-label`} class="cinder-transfer-list__label">{leftLabel}</h3>
    <ul
      class="cinder-transfer-list__list"
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={`${baseId}-left-label`}
      aria-activedescendant={leftActiveOptionId}
      tabindex="0"
      onfocus={() => handleListFocus('left')}
      onclick={(event) => handleListClick(event, 'left')}
      onkeydown={(event) => handleListKeydown(event, 'left')}
    >
      {#each leftItems as item, index (item.id)}
        <li
          id={optionId('left', index)}
          class="cinder-transfer-list__option"
          role="option"
          aria-selected={leftSelectedSet.has(item.id) ? 'true' : 'false'}
          aria-disabled={item.disabled ? 'true' : undefined}
          data-cinder-active={resolvedLeftActiveId === item.id ? 'true' : undefined}
          data-cinder-transfer-list-item-id={item.id}
        >
          {item.label}
        </li>
      {:else}
        <li class="cinder-transfer-list__empty" role="presentation">No available items</li>
      {/each}
    </ul>
  </section>

  <div class="cinder-transfer-list__controls" role="group" aria-label="Transfer controls">
    <button
      type="button"
      class="cinder-transfer-list__control"
      aria-label={`Move selected items to ${rightLabel}`}
      disabled={movableLeftSelectedIds.length === 0}
      onclick={moveSelectedRight}
    >
      Add
    </button>
    <button
      type="button"
      class="cinder-transfer-list__control"
      aria-label={`Move all items to ${rightLabel}`}
      disabled={movableLeftItemIds.length === 0}
      onclick={moveAllRight}
    >
      Add all
    </button>
    <button
      type="button"
      class="cinder-transfer-list__control"
      aria-label={`Move selected items to ${leftLabel}`}
      disabled={movableRightSelectedIds.length === 0}
      onclick={moveSelectedLeft}
    >
      Remove
    </button>
    <button
      type="button"
      class="cinder-transfer-list__control"
      aria-label={`Move all items to ${leftLabel}`}
      disabled={movableRightItemIds.length === 0}
      onclick={moveAllLeft}
    >
      Remove all
    </button>
  </div>

  <section class="cinder-transfer-list__panel" aria-labelledby={`${baseId}-right-label`}>
    <h3 id={`${baseId}-right-label`} class="cinder-transfer-list__label">{rightLabel}</h3>
    <ul
      class="cinder-transfer-list__list"
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={`${baseId}-right-label`}
      aria-activedescendant={rightActiveOptionId}
      tabindex="0"
      onfocus={() => handleListFocus('right')}
      onclick={(event) => handleListClick(event, 'right')}
      onkeydown={(event) => handleListKeydown(event, 'right')}
    >
      {#each rightItems as item, index (item.id)}
        <li
          id={optionId('right', index)}
          class="cinder-transfer-list__option"
          role="option"
          aria-selected={rightSelectedSet.has(item.id) ? 'true' : 'false'}
          aria-disabled={item.disabled ? 'true' : undefined}
          data-cinder-active={resolvedRightActiveId === item.id ? 'true' : undefined}
          data-cinder-transfer-list-item-id={item.id}
        >
          {item.label}
        </li>
      {:else}
        <li class="cinder-transfer-list__empty" role="presentation">No selected items</li>
      {/each}
    </ul>
  </section>

  <div role="alert" aria-atomic="true" class="cinder-sr-only">{announcer.message}</div>
</div>
