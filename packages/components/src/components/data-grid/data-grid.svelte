<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Static ARIA data grid foundation for spreadsheet-like datasets with explicit row identity, column sizing, keyboard navigation, and pinning metadata.
   * @tag grid
   * @tag data
   * @tag spreadsheet
   * @useWhen Rendering interactive tabular data that will need grid behavior such as selection, virtualization, resizing, or editing.
   * @useWhen You need role=grid semantics instead of native table semantics.
   * @avoidWhen You only need a semantic read-only table — use DataTable or the Table family instead.
   * @avoidWhen You need selection, virtualization, resizing, reordering, or editing today — DataGrid does not provide them yet.
   * @related data-table, table
   */
  export type {
    DataGridCellContext,
    DataGridColumnDef,
    DataGridColumnPin,
    DataGridColumnPinning,
    DataGridColumnSizing,
    DataGridDensity,
    DataGridProps,
    DataGridSortComparator,
    DataGridSortDirection,
    DataGridSortModel,
    DataGridSortModelItem,
  } from './data-grid.types.ts';
</script>

<script lang="ts" generics="TRow">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import {
    DataGridColumnModel,
    getDataGridColumnValue,
    type ResolvedDataGridColumn,
  } from './_internal/column-model.svelte.ts';
  import {
    getActiveDataGridSortModel,
    getNextDataGridSortModel,
    getSortedDataGridRowIndices,
  } from './_internal/sort-model.ts';
  import type { DataGridProps, DataGridSortModelItem } from './data-grid.types.ts';

  let {
    rows,
    columns,
    getRowId,
    density = 'comfortable',
    stickyHeader = true,
    columnOrder,
    columnSizing,
    columnPinning,
    sortModel = $bindable([]),
    onSortModelChange,
    rowClass,
    getRowAriaLabel,
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onkeydown: consumerOnKeydown,
    ...rest
  }: DataGridProps<TRow> = $props();

  const columnModel = new DataGridColumnModel<TRow>({
    columns: () => columns,
    columnOrder: () => columnOrder,
    columnSizing: () => columnSizing,
    columnPinning: () => columnPinning,
  });

  const activeSortModel = $derived(
    getActiveDataGridSortModel(columnModel.orderedColumns, sortModel),
  );
  const sortedRowIndices = $derived(
    getSortedDataGridRowIndices(rows, columnModel.orderedColumns, activeSortModel),
  );
  const gridTemplateColumns = $derived(
    columnModel.renderColumns.map((column) => `${column.width}px`).join(' '),
  );
  const keyedRows = $derived.by(() => {
    const records = rows.map((row, rowIndex) => ({
      row,
      rowId: getRowId(row),
      rowIndex,
    }));
    const rowIdCounts = new Map<string, number>();
    for (const { rowId } of records) {
      rowIdCounts.set(rowId, (rowIdCounts.get(rowId) ?? 0) + 1);
    }
    const rowIdOccurrences = new Map<string, number>();
    return records.map((record) => {
      const occurrence = rowIdOccurrences.get(record.rowId) ?? 0;
      rowIdOccurrences.set(record.rowId, occurrence + 1);
      const hasDuplicateRowId = (rowIdCounts.get(record.rowId) ?? 0) > 1;
      const uniqueRowId = hasDuplicateRowId ? `${record.rowId}\u0000${occurrence}` : record.rowId;
      return {
        ...record,
        rowDomId: uniqueRowId,
        rowKey: uniqueRowId,
      };
    });
  });
  const sortedKeyedRows = $derived(
    sortedRowIndices.flatMap((rowIndex) => keyedRows[rowIndex] ?? []),
  );
  const duplicateRowIds = $derived.by(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const { rowId } of keyedRows) {
      if (seen.has(rowId)) duplicates.add(rowId);
      else seen.add(rowId);
    }
    return [...duplicates];
  });
  const firstRowDomId = $derived(keyedRows[0]?.rowDomId);
  const firstColumnKey = $derived(columnModel.renderColumns[0]?.key);
  const gridId = $props.id();
  let requestedActiveRowIndex = $state(0);
  let requestedActiveColumnKey = $state<string | undefined>();
  const activeRowIndex = $derived(
    sortedKeyedRows.length > 0 ? Math.min(requestedActiveRowIndex, sortedKeyedRows.length - 1) : 0,
  );
  const activeColumnIndex = $derived.by(() => {
    const index = columnModel.renderColumns.findIndex(
      (column) => column.key === requestedActiveColumnKey,
    );
    return index >= 0 ? index : 0;
  });
  const activeRowDomId = $derived(
    sortedKeyedRows.length > 0
      ? sortedKeyedRows[Math.min(activeRowIndex, sortedKeyedRows.length - 1)]?.rowDomId
      : firstRowDomId,
  );
  const activeCellId = $derived(
    activeRowDomId !== undefined && firstColumnKey !== undefined
      ? getCellId(
          activeRowDomId,
          columnModel.renderColumns[activeColumnIndex]?.key ?? firstColumnKey,
        )
      : undefined,
  );
  const resolvedAriaLabel = $derived(
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel : undefined,
  );
  const resolvedAriaLabelledBy = $derived(
    typeof ariaLabelledBy === 'string' && ariaLabelledBy.trim().length > 0
      ? ariaLabelledBy
      : undefined,
  );

  let hasWarnedNoLabel = false;
  let warnedDuplicateRowIdsSignature: string | undefined;
  let previousActiveCellId: string | undefined;

  $effect(() => {
    if (!resolvedAriaLabel && !resolvedAriaLabelledBy && !hasWarnedNoLabel) {
      hasWarnedNoLabel = true;
      devWarn('[cinder-data-grid] DataGrid requires either aria-label or aria-labelledby.');
    }
  });

  $effect(() => {
    if (duplicateRowIds.length === 0) {
      warnedDuplicateRowIdsSignature = undefined;
      return;
    }

    const signature = JSON.stringify(duplicateRowIds);
    if (signature === warnedDuplicateRowIdsSignature) return;

    warnedDuplicateRowIdsSignature = signature;
    devWarn(
      `[cinder-data-grid] getRowId returned duplicate row ids: ${duplicateRowIds
        .map((rowId) => JSON.stringify(rowId))
        .join(', ')}. Row ids must be unique.`,
    );
  });

  $effect(() => {
    const cellId = activeCellId;
    if (cellId === undefined || cellId === previousActiveCellId) {
      previousActiveCellId = cellId;
      return;
    }

    if (previousActiveCellId === undefined) {
      previousActiveCellId = cellId;
      return;
    }

    previousActiveCellId = cellId;
    document.getElementById(cellId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  function getCellId(rowId: string, columnKey: string): string {
    return `${gridId}-cell-r-${toDomIdSegment(rowId)}-c-${toDomIdSegment(columnKey)}`;
  }

  function toDomIdSegment(value: string): string {
    const segment = Array.from(value, (character) => character.codePointAt(0)?.toString(16) ?? '0');
    return segment.length > 0 ? segment.join('_') : 'empty';
  }

  function formatDataGridValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  function getRowClass(row: TRow, rowIndex: number): string | undefined {
    if (typeof rowClass === 'function') return rowClass(row, rowIndex);
    return rowClass;
  }

  function getResolvedRowAriaLabel(row: TRow, rowIndex: number): string | undefined {
    const label = getRowAriaLabel?.(row, rowIndex);
    return typeof label === 'string' && label.trim().length > 0 ? label : undefined;
  }

  function getCellStyle(column: ResolvedDataGridColumn<TRow>): string {
    const customProperties = [`--_cinder-data-grid-column-width: ${column.width}px`];
    if (column.pin === 'left') {
      customProperties.push(`--_cinder-data-grid-pin-left-offset: ${column.pinOffset}px`);
    }
    if (column.pin === 'right') {
      customProperties.push(`--_cinder-data-grid-pin-right-offset: ${column.pinOffset}px`);
    }
    return customProperties.join('; ');
  }

  function getColumnSortModelItem(columnKey: string): DataGridSortModelItem | undefined {
    return activeSortModel.find((item) => item.key === columnKey);
  }

  function getColumnSortPriority(columnKey: string): number | undefined {
    const index = activeSortModel.findIndex((item) => item.key === columnKey);
    return index >= 0 && activeSortModel.length > 1 ? index + 1 : undefined;
  }

  function getHeaderAriaSort(
    column: ResolvedDataGridColumn<TRow>,
    sortItem: DataGridSortModelItem | undefined,
  ): DataGridSortModelItem['direction'] | undefined {
    return activeSortModel[0]?.key === column.key ? sortItem?.direction : undefined;
  }

  function getSortStateDescription(
    sortItem: DataGridSortModelItem | undefined,
    sortPriority: number | undefined,
  ): string {
    if (!sortItem) return 'not sorted';
    if (sortPriority === undefined) return `sorted ${sortItem.direction}`;
    return `sorted ${sortItem.direction}, priority ${sortPriority}`;
  }

  function handleColumnHeaderClick(column: ResolvedDataGridColumn<TRow>, event: MouseEvent): void {
    if (!column.sortable) return;

    const nextSortModel = getNextDataGridSortModel(activeSortModel, column.key, event.shiftKey);
    sortModel = nextSortModel;
    onSortModelChange?.(nextSortModel);
  }

  function moveActiveCell(rowIndex: number, columnIndex: number): void {
    if (sortedKeyedRows.length === 0 || columnModel.renderColumns.length === 0) return;
    requestedActiveRowIndex = Math.min(Math.max(rowIndex, 0), sortedKeyedRows.length - 1);
    requestedActiveColumnKey =
      columnModel.renderColumns[
        Math.min(Math.max(columnIndex, 0), columnModel.renderColumns.length - 1)
      ]?.key;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (consumerOnKeydown) {
      (consumerOnKeydown as (event: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('.cinder-data-grid__sort-button')) {
      return;
    }

    if (sortedKeyedRows.length === 0 || columnModel.renderColumns.length === 0) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveActiveCell(activeRowIndex, activeColumnIndex + 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveActiveCell(activeRowIndex, activeColumnIndex - 1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveCell(activeRowIndex + 1, activeColumnIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveCell(activeRowIndex - 1, activeColumnIndex);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveActiveCell(event.ctrlKey ? 0 : activeRowIndex, 0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveActiveCell(
        event.ctrlKey ? sortedKeyedRows.length - 1 : activeRowIndex,
        columnModel.renderColumns.length - 1,
      );
    }
  }
</script>

<div
  {...rest}
  class={classNames('cinder-data-grid', className)}
  role="grid"
  aria-rowcount={rows.length + 1}
  aria-colcount={columnModel.orderedColumns.length}
  aria-label={resolvedAriaLabel}
  aria-labelledby={resolvedAriaLabelledBy}
  aria-activedescendant={activeCellId}
  tabindex="0"
  onkeydown={handleKeydown}
  data-cinder-density={density}
  data-cinder-sticky-header={stickyHeader ? 'true' : undefined}
  style:--_cinder-data-grid-template-columns={gridTemplateColumns}
>
  <div class="cinder-data-grid__header-row" role="row" aria-rowindex="1">
    {#each columnModel.renderColumns as column (column.key)}
      {@const sortItem = getColumnSortModelItem(column.key)}
      {@const sortPriority = getColumnSortPriority(column.key)}
      <div
        class="cinder-data-grid__header-cell"
        role="columnheader"
        aria-colindex={column.colIndex}
        aria-sort={column.sortable ? getHeaderAriaSort(column, sortItem) : undefined}
        data-cinder-pin={column.pin}
        data-cinder-sortable={column.sortable ? 'true' : undefined}
        data-cinder-sort-direction={sortItem?.direction}
        style={getCellStyle(column)}
      >
        {#if column.sortable}
          <button
            class="cinder-data-grid__sort-button"
            type="button"
            onclick={(event) => handleColumnHeaderClick(column, event)}
          >
            <span class="cinder-data-grid__header-content">
              {#if typeof column.header === 'function'}
                {@render column.header()}
              {:else}
                {column.header}
              {/if}
            </span>
            <span class="cinder-data-grid__sort-indicator" aria-hidden="true">
              {#if sortItem?.direction === 'ascending'}
                Asc
              {:else if sortItem?.direction === 'descending'}
                Desc
              {/if}
            </span>
            {#if sortPriority !== undefined}
              <span class="cinder-data-grid__sort-priority" aria-hidden="true">
                {sortPriority}
              </span>
            {/if}
            <span class="cinder-sr-only">{getSortStateDescription(sortItem, sortPriority)}</span>
          </button>
        {:else if typeof column.header === 'function'}
          {@render column.header()}
        {:else}
          {column.header}
        {/if}
      </div>
    {/each}
  </div>

  <div class="cinder-data-grid__body" role="rowgroup">
    {#each sortedKeyedRows as keyedRow, visualRowIndex (keyedRow.rowKey)}
      {@const row = keyedRow.row}
      {@const rowId = keyedRow.rowDomId}
      {@const rowIndex = visualRowIndex}
      <div
        class={classNames('cinder-data-grid__row', getRowClass(row, rowIndex))}
        role="row"
        aria-rowindex={visualRowIndex + 2}
        aria-label={getResolvedRowAriaLabel(row, rowIndex)}
      >
        {#each columnModel.renderColumns as column (column.key)}
          {@const value = getDataGridColumnValue(row, column)}
          {@const cellId = getCellId(rowId, column.key)}
          <div
            id={cellId}
            class="cinder-data-grid__cell"
            role="gridcell"
            aria-colindex={column.colIndex}
            tabindex="-1"
            data-cinder-pin={column.pin}
            data-cinder-active={activeCellId === cellId ? 'true' : undefined}
            style={getCellStyle(column)}
          >
            {#if column.cell}
              {@render column.cell({ row, value, editing: false })}
            {:else}
              {formatDataGridValue(value)}
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
