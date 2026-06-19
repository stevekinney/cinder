<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Data-driven convenience wrapper over the compositional Table family that renders a full semantic table from a columns array and a rows array.
   * @tag table
   * @tag data
   * @useWhen Rendering a structured dataset where columns and rows are known at runtime (e.g. API responses, config-driven dashboards).
   * @useWhen You want correct scope=col / scope=row semantics and aria-sort wiring without writing Table.Header / Table.Body manually.
   * @avoidWhen You need custom cell rendering, interactive cells, nested components, or column spanning — use the compositional Table family directly.
   * @avoidWhen You need row selection — DataTable does not expose a selection prop; use Table with selectable instead.
   * @related table, table-header, table-body, table-row, table-cell, table-header-cell
   */
  export type { DataTableColumn, DataTableProps, DataTableRow } from './data-table.types.ts';
</script>

<script lang="ts" generics="Row extends DataTableRow">
  import { tick } from 'svelte';

  import TableBody from '../table-body/table-body.svelte';
  import TableCell from '../table-cell/table-cell.svelte';
  import TableHeaderCell from '../table-header-cell/table-header-cell.svelte';
  import TableHeader from '../table-header/table-header.svelte';
  import TableRow from '../table-row/table-row.svelte';
  import TableRoot from '../table/table.svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    getFixedVirtualWindow,
    parsePixelLength,
    resolveVirtualItemHeight,
    resolveVirtualOverscan,
  } from '../../utilities/fixed-virtual-window.ts';
  import type { DataTableColumn, DataTableProps, DataTableRow } from './data-table.types.ts';

  let {
    columns,
    rows,
    caption,
    sort = $bindable(),
    stickyHeader = false,
    density = 'comfortable',
    scrollable = false,
    virtualized = false,
    rowHeight = 44,
    overscan = 5,
    height = '24rem',
    stickToBottom = false,
    onscroll: onScroll,
    class: className,
    ...rest
  }: DataTableProps<Row> = $props();

  let wrapperElement: HTMLElement | undefined = $state();
  let scrollOffset = $state(0);
  let measuredViewportHeight = $state(0);
  let captionHeight = $state(0);
  let headerHeight = $state(0);
  let activeRowIndex = $state(0);
  let previousRowCount = 0;
  let hasObservedRowCount = false;
  let shouldStickAfterAppend = false;

  /**
   * The key of the row-header column. Explicitly set via `column.rowHeader === true`,
   * or falls back to the first column's key. Used to render `<th scope="row">` on
   * the appropriate body cell.
   */
  const rowHeaderKey = $derived(
    (columns.find((column) => column.rowHeader === true) ?? columns[0])?.key,
  );
  const shouldVirtualizeRows = $derived(virtualized);
  const resolvedRowHeight = $derived(resolveVirtualItemHeight(rowHeight, 44));
  const resolvedOverscan = $derived(resolveVirtualOverscan(overscan));
  const viewportHeight = $derived(
    measuredViewportHeight || estimateViewportHeight(height, resolvedRowHeight),
  );
  const virtualWindow = $derived(
    getFixedVirtualWindow({
      itemCount: rows.length,
      itemHeight: resolvedRowHeight,
      scrollOffset,
      viewportHeight,
      overscan: resolvedOverscan,
    }),
  );
  const virtualRows = $derived(
    shouldVirtualizeRows
      ? virtualWindow.items.flatMap((virtualItem) => {
          const row = rows[virtualItem.index];
          return row === undefined ? [] : [{ ...virtualItem, row }];
        })
      : rows.map((row, index) => ({
          row,
          index,
          key: index,
          start: index * resolvedRowHeight,
          size: resolvedRowHeight,
        })),
  );
  const tabbableRowIndex = $derived(getTabbableRowIndex());

  /**
   * Map a DataTableColumn's `align` value to the value accepted by TableHeaderCell
   * and TableCell (`'left' | 'center' | 'right'`).
   */
  function mapAlign(align: DataTableColumn['align']): 'left' | 'center' | 'right' | undefined {
    if (align === 'start') return 'left';
    if (align === 'end') return 'right';
    if (align === 'center') return 'center';
    return undefined;
  }

  $effect(() => {
    const element = wrapperElement;
    if (!element || !shouldVirtualizeRows) return;

    syncScrollMetrics(element);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => syncScrollMetrics(element));
    observer.observe(element);
    const caption = element.querySelector('caption');
    if (caption) observer.observe(caption);
    const header = element.querySelector('thead');
    if (header) observer.observe(header);
    return () => observer.disconnect();
  });

  $effect.pre(() => {
    const rowCount = rows.length;
    const element = wrapperElement;

    if (!hasObservedRowCount) {
      previousRowCount = rowCount;
      hasObservedRowCount = true;
      shouldStickAfterAppend = false;
      return;
    }

    shouldStickAfterAppend =
      shouldVirtualizeRows &&
      stickToBottom &&
      element !== undefined &&
      rowCount > previousRowCount &&
      isAtBottom(
        element,
        previousRowCount * resolvedRowHeight,
        viewportHeight,
        getTableChromeHeight(captionHeight, headerHeight),
      );

    previousRowCount = rowCount;
  });

  $effect(() => {
    const rowCount = rows.length;
    const element = wrapperElement;
    if (!shouldVirtualizeRows || !stickToBottom || !shouldStickAfterAppend || !element) return;

    void tick().then(() => {
      element.scrollTop = maxScrollTop(
        rowCount * resolvedRowHeight,
        viewportHeight,
        getTableChromeHeight(captionHeight, headerHeight),
      );
      syncScrollMetrics(element);
      shouldStickAfterAppend = false;
    });
  });

  function estimateViewportHeight(value: string | undefined, fallbackRowHeight: number): number {
    return parsePixelLength(value) ?? fallbackRowHeight * 10;
  }

  function getCaptionHeight(element: HTMLElement): number {
    const captionElement = element.querySelector<HTMLElement>('caption');
    if (!captionElement) return 0;
    const rect = captionElement.getBoundingClientRect();
    return rect.height || captionElement.offsetHeight || 0;
  }

  function getHeaderHeight(element: HTMLElement): number {
    const header = element.querySelector<HTMLElement>('thead');
    if (!header) return 0;
    const rect = header.getBoundingClientRect();
    return rect.height || header.offsetHeight || 0;
  }

  function syncScrollMetrics(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const nextCaptionHeight = getCaptionHeight(element);
    const nextHeaderHeight = getHeaderHeight(element);
    measuredViewportHeight =
      rect.height || element.clientHeight || parsePixelLength(height) || resolvedRowHeight * 10;
    captionHeight = nextCaptionHeight;
    headerHeight = nextHeaderHeight;
    scrollOffset = Math.max(
      0,
      element.scrollTop - getBodyScrollOrigin(nextCaptionHeight, nextHeaderHeight),
    );
  }

  function handleWrapperScroll(
    event: UIEvent & { currentTarget: EventTarget & HTMLDivElement },
  ): void {
    if (typeof onScroll === 'function') onScroll(event);
    if (!shouldVirtualizeRows) return;
    syncScrollMetrics(event.currentTarget as HTMLElement);
  }

  function maxScrollTop(totalBodyHeight: number, visibleHeight: number, chromeBlockSize: number) {
    return Math.max(0, chromeBlockSize + totalBodyHeight - visibleHeight);
  }

  function getTableChromeHeight(captionBlockSize: number, headerBlockSize: number): number {
    return captionBlockSize + headerBlockSize;
  }

  function getBodyScrollOrigin(captionBlockSize: number, headerBlockSize: number): number {
    return stickyHeader
      ? captionBlockSize
      : getTableChromeHeight(captionBlockSize, headerBlockSize);
  }

  function getTabbableRowIndex(): number {
    if (!shouldVirtualizeRows) return activeRowIndex;
    if (virtualRows.some((virtualRow) => virtualRow.index === activeRowIndex)) {
      return activeRowIndex;
    }
    return virtualRows[0]?.index ?? activeRowIndex;
  }

  function isAtBottom(
    element: HTMLElement,
    totalBodyHeight: number,
    visibleHeight: number,
    chromeBlockSize: number,
  ): boolean {
    return element.scrollTop >= maxScrollTop(totalBodyHeight, visibleHeight, chromeBlockSize) - 1;
  }

  function clampRowIndex(index: number): number {
    return Math.min(Math.max(0, index), Math.max(0, rows.length - 1));
  }

  function scrollToRow(index: number): void {
    const element = wrapperElement;
    if (!element) return;

    const rowScrollTop =
      index === 0
        ? 0
        : getBodyScrollOrigin(captionHeight, headerHeight) + index * resolvedRowHeight;

    element.scrollTop = Math.min(
      maxScrollTop(
        rows.length * resolvedRowHeight,
        viewportHeight,
        getTableChromeHeight(captionHeight, headerHeight),
      ),
      rowScrollTop,
    );
    syncScrollMetrics(element);
  }

  function focusRow(index: number): void {
    const nextIndex = clampRowIndex(index);
    activeRowIndex = nextIndex;
    scrollToRow(nextIndex);

    void tick().then(() => {
      const row = wrapperElement?.querySelector<HTMLElement>(
        `[data-cinder-data-table-row-index="${nextIndex}"]`,
      );
      row?.focus({ preventScroll: true });
    });
  }

  function handleRowFocus(index: number): void {
    activeRowIndex = clampRowIndex(index);
  }

  function handleRowKeydown(event: KeyboardEvent, index: number): void {
    if (!shouldVirtualizeRows) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusRow(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusRow(rows.length - 1);
    }
  }
</script>

{#snippet table()}
  <TableRoot
    {...caption !== undefined ? { caption } : {}}
    {...shouldVirtualizeRows ? { 'aria-rowcount': rows.length + 1 } : {}}
    {stickyHeader}
    {density}
    bind:sort
  >
    <TableHeader>
      <TableRow>
        {#each columns as column (column.key)}
          <TableHeaderCell
            {...column.sortable ? { column: column.key } : {}}
            sortable={column.sortable ?? false}
            align={mapAlign(column.align) ?? 'left'}
          >
            {column.label}
          </TableHeaderCell>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      <!-- Key by positional index, not the row-header value: row-header values
           (names, labels, statuses) are display data and are NOT guaranteed
           unique, so keying by them would corrupt row identity when two rows
           share a value. DataTable does not reorder rows itself, so the index
           is a stable identity for the consumer-owned ordering. -->
      {#if shouldVirtualizeRows && virtualWindow.leadingSize > 0}
        <tr class="cinder-data-table__virtual-spacer" aria-hidden="true">
          <td
            class="cinder-data-table__virtual-spacer-cell"
            colspan={columns.length}
            style:height={`${virtualWindow.leadingSize}px`}
          ></td>
        </tr>
      {/if}
      {#each virtualRows as virtualRow (virtualRow.key)}
        <TableRow
          {...shouldVirtualizeRows
            ? {
                'aria-rowindex': virtualRow.index + 2,
                tabindex: tabbableRowIndex === virtualRow.index ? 0 : -1,
                'data-cinder-virtual-row': 'true',
                'data-cinder-data-table-row-index': virtualRow.index,
                onfocus: () => handleRowFocus(virtualRow.index),
                onkeydown: (event: KeyboardEvent) => handleRowKeydown(event, virtualRow.index),
              }
            : {}}
        >
          {#each columns as column (column.key)}
            <TableCell
              as={column.key === rowHeaderKey ? 'th' : 'td'}
              align={mapAlign(column.align) ?? 'left'}
            >
              {virtualRow.row[column.key]}
            </TableCell>
          {/each}
        </TableRow>
      {/each}
      {#if shouldVirtualizeRows && virtualWindow.trailingSize > 0}
        <tr class="cinder-data-table__virtual-spacer" aria-hidden="true">
          <td
            class="cinder-data-table__virtual-spacer-cell"
            colspan={columns.length}
            style:height={`${virtualWindow.trailingSize}px`}
          ></td>
        </tr>
      {/if}
    </TableBody>
  </TableRoot>
{/snippet}

<div
  {...rest}
  bind:this={wrapperElement}
  class={classNames(
    'cinder-data-table',
    scrollable || shouldVirtualizeRows ? 'cinder-table-scroll' : undefined,
    className,
  )}
  data-cinder-virtualized={shouldVirtualizeRows ? 'true' : undefined}
  style:--cinder-data-table-height={shouldVirtualizeRows ? height : undefined}
  style:--_cinder-data-table-row-height={shouldVirtualizeRows
    ? `${resolvedRowHeight}px`
    : undefined}
  onscroll={handleWrapperScroll}
>
  {@render table()}
</div>
