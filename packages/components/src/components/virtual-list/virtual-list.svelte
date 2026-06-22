<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Fixed-height windowing primitive for long vertical lists that renders only the visible rows plus overscan inside a native scroll container.
   * @tag list
   * @tag virtualization
   * @tag performance
   * @useWhen Rendering thousands of same-height append-only rows such as logs, event streams, or activity feeds.
   * @useWhen You need a reusable primitive that owns native vertical scrolling but leaves row markup to a snippet.
   * @avoidWhen Rows have substantially variable heights that must be measured dynamically — v1 requires a fixed itemHeight.
   * @avoidWhen Rendering columns or two-dimensional grids — use data-grid for grid semantics and column virtualization.
   * @related data-list, data-table, data-grid
   */
  export type { VirtualListProps, VirtualListRowContext } from './virtual-list.types.ts';
  export type {
    FixedVirtualWindow,
    FixedVirtualWindowItem,
  } from '../../utilities/fixed-virtual-window.ts';
  export {
    getFixedVirtualWindow,
    parsePixelLength,
    resolveVirtualItemHeight,
    resolveVirtualOverscan,
  } from '../../utilities/fixed-virtual-window.ts';
</script>

<script lang="ts" generics="Item">
  import { tick } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { useResizeObserver } from '../../utilities/use-resize-observer.svelte.ts';
  import type { VirtualListProps } from './virtual-list.types.ts';
  import {
    getFixedVirtualWindow,
    parsePixelLength,
    resolveVirtualItemHeight,
    resolveVirtualOverscan,
  } from '../../utilities/fixed-virtual-window.ts';

  let {
    items,
    itemHeight,
    overscan = 5,
    height = '20rem',
    stickToBottom = false,
    tabindex = 0,
    getKey,
    row,
    role = 'list',
    onscroll: onScroll,
    class: className,
    ...rest
  }: VirtualListProps<Item> = $props();

  let scrollElement: HTMLElement | undefined = $state();
  let scrollOffset = $state(0);
  let measuredViewportHeight = $state(0);
  let previousItemCount = 0;
  let hasObservedItemCount = false;
  let shouldStickAfterAppend = false;

  const resolvedItemHeight = $derived(resolveVirtualItemHeight(itemHeight));
  const resolvedOverscan = $derived(resolveVirtualOverscan(overscan));
  const viewportHeight = $derived(
    measuredViewportHeight || estimateViewportHeight(height, resolvedItemHeight),
  );
  const virtualWindow = $derived(
    getFixedVirtualWindow({
      itemCount: items.length,
      itemHeight: resolvedItemHeight,
      scrollOffset,
      viewportHeight,
      overscan: resolvedOverscan,
      getKey: (index) => {
        const item = items[index];
        return item === undefined ? index : (getKey?.(item, index) ?? index);
      },
    }),
  );
  const renderedItems = $derived(
    virtualWindow.items.flatMap((virtualItem) => {
      const item = items[virtualItem.index];
      return item === undefined ? [] : [{ ...virtualItem, item }];
    }),
  );

  $effect(() => {
    const element = scrollElement;
    if (!element) return;
    syncViewport(element);
  });

  const observeResize = useResizeObserver(() => {
    if (scrollElement) syncViewport(scrollElement);
  });

  $effect.pre(() => {
    const itemCount = items.length;
    const element = scrollElement;

    if (!hasObservedItemCount) {
      previousItemCount = itemCount;
      hasObservedItemCount = true;
      shouldStickAfterAppend = false;
      return;
    }

    shouldStickAfterAppend =
      stickToBottom &&
      element !== undefined &&
      itemCount > previousItemCount &&
      isAtBottom(element, previousItemCount * resolvedItemHeight, viewportHeight);

    previousItemCount = itemCount;
  });

  $effect(() => {
    const itemCount = items.length;
    const element = scrollElement;
    if (!stickToBottom || !shouldStickAfterAppend || !element) return;

    void tick().then(() => {
      element.scrollTop = maxScrollOffset(itemCount * resolvedItemHeight, viewportHeight);
      syncViewport(element);
      shouldStickAfterAppend = false;
    });
  });

  function estimateViewportHeight(value: string | undefined, resolvedRowHeight: number): number {
    return parsePixelLength(value) ?? resolvedRowHeight * 10;
  }

  function syncViewport(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    measuredViewportHeight =
      rect.height || element.clientHeight || parsePixelLength(height) || resolvedItemHeight * 10;
    scrollOffset = Math.max(0, element.scrollTop);
  }

  function handleScroll(event: UIEvent & { currentTarget: EventTarget & HTMLDivElement }): void {
    if (typeof onScroll === 'function') onScroll(event);
    const element = event.currentTarget as HTMLElement;
    scrollOffset = Math.max(0, element.scrollTop);
  }

  function maxScrollOffset(totalSize: number, height: number): number {
    return Math.max(0, totalSize - height);
  }

  function isAtBottom(element: HTMLElement, totalSize: number, height: number): boolean {
    return element.scrollTop >= maxScrollOffset(totalSize, height) - 1;
  }
</script>

<svelte:element
  this={'div'}
  {...rest}
  bind:this={scrollElement}
  {@attach observeResize}
  class={classNames('cinder-virtual-list', className)}
  {role}
  {tabindex}
  data-cinder-stick-to-bottom={stickToBottom ? 'true' : undefined}
  style:--cinder-virtual-list-height={height}
  onscroll={handleScroll}
>
  <div
    class="cinder-virtual-list__spacer"
    style:height={`${virtualWindow.totalSize}px`}
    aria-hidden={items.length === 0 ? 'true' : undefined}
  >
    <div class="cinder-virtual-list__window" style:top={`${virtualWindow.leadingSize}px`}>
      {#each renderedItems as virtualItem (virtualItem.key)}
        <div
          class="cinder-virtual-list__row"
          role={role === 'list' ? 'listitem' : undefined}
          data-cinder-virtual-index={virtualItem.index}
          style:height={`${virtualItem.size}px`}
        >
          {@render row(virtualItem.item, {
            index: virtualItem.index,
            key: virtualItem.key,
            start: virtualItem.start,
            size: virtualItem.size,
          })}
        </div>
      {/each}
    </div>
  </div>
</svelte:element>
