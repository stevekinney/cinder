<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Keyboard-and-pointer reorderable list that emits onreorder when the user drags or arrow-keys an item into a new position with announcer feedback.
   * @tag data-display
   * @tag reorder
   * @useWhen Letting users manually reorder a small to medium list of items via drag handle or keyboard.
   * @useWhen Surfacing live region announcements during a reorder for accessible feedback.
   * @avoidWhen Showing a read-only list with no reorder affordance — use grid-list instead.
   * @avoidWhen Sorting by a column or computed key — sort the source array and rerender.
   * @related grid-list
   */
  export type { SortableListProps } from './sortable-list.types.ts';
</script>

<script lang="ts" generics="Item">
  import { cn } from '../../utilities/class-names.ts';
  import {
    SortableController,
    setSortableContext,
    reorder,
  } from '../../utilities/sortable-controller.svelte.ts';
  import { useAnnouncer } from '../../utilities/use-announcer.svelte.ts';
  import { useId } from '../../utilities/use-id.ts';
  import SortableItem from '../_sortable-item.svelte';
  import type { SortableListProps } from './sortable-list.types.ts';

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
