<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type {
    SortableAnnouncements,
    SortableItemContext,
    SortableReorderChange,
  } from '../utilities/sortable-controller.svelte.ts';

  /** Props for the SortableList component. */
  export type SortableListProps<Item> = {
    /** The list of items to render. */
    items: Item[];
    /** Returns a stable key for each item. Must not change across reorders. */
    getKey: (item: Item) => string | number;
    /**
     * Returns an accessible label for each item (e.g., "Buy milk").
     * The second argument is the item's original index in the `items` array
     * (not its current visual position during a drag).
     * Used in handle aria-label and announcements.
     */
    getItemLabel: (item: Item, originalIndex: number) => string;
    /** Optional formatter for the drag handle's accessible name. Default: "Reorder {itemLabel}". */
    formatHandleLabel?: (itemLabel: string) => string;
    /** Optional snippet rendered inside the drag-handle button. Receives { pressed, label }. */
    handle?: Snippet<[{ pressed: boolean; label: string }]>;
    /** Fires with the full reordered array and change metadata on drop. */
    onreorder: (
      nextItems: Item[],
      change: import('../utilities/sortable-controller.svelte.ts').SortableReorderChange,
    ) => void;
    /** Optional overrides for announcement strings. */
    announcements?: Partial<
      import('../utilities/sortable-controller.svelte.ts').SortableAnnouncements
    >;
    /** Row content snippet. Receives the item and a per-row context. */
    children: Snippet<
      [Item, import('../utilities/sortable-controller.svelte.ts').SortableItemContext]
    >;
    /** Accessible name for the list (applied as aria-label on the list root). */
    label?: string;
    class?: string;
  };
</script>

<script lang="ts" generics="Item">
  import { useAnnouncer } from '../utilities/use-announcer.svelte.ts';
  import { useId } from '../utilities/use-id.ts';
  import { cn } from '../utilities/class-names.ts';
  import {
    SortableController,
    setSortableContext,
    reorder,
  } from '../utilities/sortable-controller.svelte.ts';
  import SortableItem from './_sortable-item.svelte';

  let {
    items,
    getKey,
    getItemLabel,
    formatHandleLabel = (label) => `Reorder ${label}`,
    handle,
    onreorder,
    announcements,
    children: renderRow,
    label,
    class: className,
  }: SortableListProps<Item> = $props();

  const announcer = useAnnouncer({ clearDelay: 5000 });
  const controller = new SortableController<Item>({
    announce: (msg) => announcer.announce(msg),
    ...(announcements !== undefined ? { announcements } : {}),
  });

  const instructionsId = useId('cinder-sortable-instructions');

  // Derived visual order — pure read of controller state, no side effects.
  const visualItems = $derived.by(() => {
    if (controller.phase !== 'lifted' || controller.liftedKey === null) return items;
    const from = items.findIndex((it) => getKey(it) === controller.liftedKey);
    if (from < 0) return items;
    return reorder(items, from, controller.liftedTo);
  });

  // Reconcile lifted key when items changes externally during a lift.
  // Reading each key forces deep tracking so in-place array mutations are caught.
  $effect(() => {
    items.forEach((it) => getKey(it));
    controller.reconcileLiftedKey(items, getKey);
  });

  // Command bag passed to each SortableItem via context.
  setSortableContext({
    get controller() {
      return controller as SortableController<unknown>;
    },
    commitDrop(_itemKey, itemLabel) {
      const result = controller.drop(items, itemLabel);
      if (result) {
        onreorder(result.nextItems, result.change);
      }
    },
    cancel(itemLabel) {
      controller.cancel(itemLabel);
    },
    lift(key, fromIndex, itemLabel, total) {
      controller.lift(key, fromIndex, itemLabel, total);
    },
    move(toIndex, itemLabel, total) {
      controller.move(toIndex, itemLabel, total);
    },
  });

  // Window-level Escape handler: cancels the lift regardless of which element has focus.
  // This covers the case where focus moved off the handle during a lift (pointer drag,
  // programmatic focus change, etc.). The item-level Escape handler also calls cancel
  // when the handle is focused, but the controller guard (phase !== 'lifted') makes
  // double-cancel safe.
  function handleWindowKeydown(event: KeyboardEvent): void {
    if (controller.phase === 'lifted' && event.key === 'Escape') {
      event.preventDefault();
      controller.cancel();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<ul class={cn('cinder-sortable-list', className)} role="list" aria-label={label}>
  <!--
    Instructions live inside the <ul> as a visually hidden <li> so the element is
    present in the DOM before any handle buttons that reference it via aria-describedby.
    role="presentation" removes the implicit listitem role so this element does not
    count toward the list's item count. cinder-sr-only visually hides it with the
    clip pattern (not display:none), so browsers resolve its id for aria-describedby.
  -->
  <li role="presentation" id={instructionsId} class="cinder-sr-only">
    Press Space to lift, then arrow keys to move, Space to drop, Escape to cancel.
  </li>

  {#each visualItems as rowItem, visualIndex (getKey(rowItem))}
    {@const originalIndex = items.indexOf(rowItem)}
    {@const rowItemLabel = getItemLabel(rowItem, originalIndex >= 0 ? originalIndex : visualIndex)}
    <SortableItem
      item={rowItem}
      itemKey={getKey(rowItem)}
      index={visualIndex}
      itemLabel={rowItemLabel}
      {formatHandleLabel}
      {...handle !== undefined ? { handle } : {}}
      {instructionsId}
      total={visualItems.length}
    >
      {#snippet children(ctx)}
        {@render renderRow(rowItem, ctx)}
      {/snippet}
    </SortableItem>
  {/each}
</ul>

<!-- Live region — role="alert" (implicit assertive) avoids role/aria-live conflict -->
<div role="alert" aria-atomic="true" class="cinder-sr-only">
  {announcer.message}
</div>
