<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose ARIA data grid foundation for spreadsheet-like datasets with explicit row identity, column sizing, keyboard navigation, range selection, and pinning metadata.
   * @tag grid
   * @tag data
   * @tag spreadsheet
   * @useWhen Rendering interactive tabular data that will need grid behavior such as selection, virtualization, resizing, or editing.
   * @useWhen You need role=grid semantics instead of native table semantics.
   * @avoidWhen You only need a semantic read-only table — use DataTable or the Table family instead.
   * @avoidWhen You need virtualization, resizing, reordering, or editing today — DataGrid does not provide them yet.
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
    DataGridSelectionMode,
    DataGridSelectionModel,
    DataGridSortComparator,
    DataGridSortDirection,
    DataGridSortModel,
    DataGridSortModelItem,
  } from './data-grid.types.ts';
</script>

<script lang="ts" generics="TRow">
  import { classNames } from '../../utilities/class-names.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import {
    DataGridColumnModel,
    getDataGridColumnValue,
    type ResolvedDataGridColumn,
  } from './_internal/column-model.svelte.ts';
  import type { DataGridCellCoordinate } from './_internal/geometry.ts';
  import { dataGridKeyToAction } from './_internal/keyboard-model.ts';
  import { DataGridSelectionModel as InternalDataGridSelectionModel } from './_internal/selection-model.svelte.ts';
  import {
    getActiveDataGridSortModel,
    getNextDataGridSortModel,
    getSortedDataGridRowIndices,
  } from './_internal/sort-model.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import type {
    DataGridProps,
    DataGridSelectionModel,
    DataGridSortModelItem,
  } from './data-grid.types.ts';

  const interactiveDescendantSelector = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  let {
    rows,
    columns,
    getRowId,
    density = 'comfortable',
    stickyHeader = true,
    columnOrder,
    columnSizing,
    columnPinning,
    selectionMode = 'none',
    selectionModel = $bindable<DataGridSelectionModel | undefined>(undefined),
    onSelectionModelChange,
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

  let liveRegionMessage = $state('');
  let liveRegionAnnouncementSequence = $state(0);
  let mounted = $state(false);

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
  const firstRowDomId = $derived(sortedKeyedRows[0]?.rowDomId);
  const firstColumnKey = $derived(columnModel.renderColumns[0]?.key);
  const rowDomIds = $derived(sortedKeyedRows.map((row) => row.rowDomId));
  const columnKeys = $derived(columnModel.renderColumns.map((column) => column.key));
  const selectionGeometrySignature = $derived(
    `${rowDomIds.join('\u0001')}\u0002${columnKeys.join('\u0001')}`,
  );
  const gridId = $props.id();
  let requestedActiveRowIndex = $state(0);
  let requestedActiveColumnKey = $state<string | undefined>();
  const selectionState = new InternalDataGridSelectionModel({
    rowIds: () => rowDomIds,
    columnKeys: () => columnKeys,
  });
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
  const activeColumnKey = $derived(columnModel.renderColumns[activeColumnIndex]?.key);
  const activeCellId = $derived(
    activeRowDomId !== undefined && firstColumnKey !== undefined
      ? getCellId(activeRowDomId, activeColumnKey ?? firstColumnKey)
      : undefined,
  );
  const activeCellCoordinates = $derived(
    activeRowDomId !== undefined && activeColumnKey !== undefined
      ? { rowId: activeRowDomId, columnKey: activeColumnKey }
      : undefined,
  );
  const resolvedSelectionModel = $derived(selectionModel ?? []);
  const selectedRowIds = $derived(
    selectionMode === 'none' ? new Set<string>() : new Set(resolvedSelectionModel),
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
  let previousSelectionGeometrySignature: string | undefined;
  let gridElement: HTMLDivElement | undefined;

  $effect(() => {
    mounted = true;
  });

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

  $effect(() => {
    const shouldPreferFallback =
      previousSelectionGeometrySignature !== undefined &&
      previousSelectionGeometrySignature !== selectionGeometrySignature;
    previousSelectionGeometrySignature = selectionGeometrySignature;
    selectionState.reconcile(activeCellCoordinates, { preferFallback: shouldPreferFallback });
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

  function getCellCoordinate(
    rowIndex: number,
    columnIndex: number,
  ): DataGridCellCoordinate | undefined {
    const rowId = rowDomIds[Math.min(Math.max(rowIndex, 0), rowDomIds.length - 1)];
    const columnKey = columnKeys[Math.min(Math.max(columnIndex, 0), columnKeys.length - 1)];
    if (rowId === undefined || columnKey === undefined) return undefined;
    return { rowId, columnKey };
  }

  function moveActiveCell(rowIndex: number, columnIndex: number, extend = false): void {
    if (sortedKeyedRows.length === 0 || columnModel.renderColumns.length === 0) return;
    requestedActiveRowIndex = Math.min(Math.max(rowIndex, 0), sortedKeyedRows.length - 1);
    requestedActiveColumnKey =
      columnModel.renderColumns[
        Math.min(Math.max(columnIndex, 0), columnModel.renderColumns.length - 1)
      ]?.key;

    const cell = getCellCoordinate(rowIndex, columnIndex);
    if (cell) selectionState.setActiveCell(cell, { extend });
  }

  function setSelectionModel(nextSelectionModel: DataGridSelectionModel): void {
    selectionModel = nextSelectionModel;
    onSelectionModelChange?.(nextSelectionModel);
  }

  function updateRowSelection(rowId: string, event: MouseEvent | KeyboardEvent): void {
    if (selectionMode === 'none') return;
    if (selectionMode === 'single') {
      setSelectionModel([rowId]);
      return;
    }

    const isToggle = event.ctrlKey || event.metaKey;
    if (event.shiftKey) return;
    if (!isToggle) {
      setSelectionModel([rowId]);
      return;
    }

    const nextSelection = new Set(resolvedSelectionModel);
    if (nextSelection.has(rowId)) nextSelection.delete(rowId);
    else nextSelection.add(rowId);
    setSelectionModel([...nextSelection]);
  }

  function selectActiveCell(event: KeyboardEvent): void {
    const row = sortedKeyedRows[activeRowIndex];
    if (!row || activeColumnKey === undefined || activeRowDomId === undefined) return;
    selectionState.setActiveCell(
      { rowId: activeRowDomId, columnKey: activeColumnKey },
      { extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey },
    );
    updateRowSelection(row.rowId, event);
  }

  function collapseSelectionToActiveCell(): void {
    selectionState.collapseToActiveCell();
    if (selectionMode === 'none') return;

    const row = sortedKeyedRows[activeRowIndex];
    setSelectionModel(row ? [row.rowId] : []);
  }

  async function copySelectedCells(): Promise<void> {
    const cells =
      selectionState.selectedCellCoordinates.length > 0
        ? sortCellsByGridOrder(selectionState.selectedCellCoordinates)
        : activeCellCoordinates
          ? [activeCellCoordinates]
          : [];
    if (cells.length === 0) return;

    const rowsByDomId = new Map(keyedRows.map((row) => [row.rowDomId, row.row]));
    const columnsByKey = new Map(columnModel.renderColumns.map((column) => [column.key, column]));
    const cellsByRow = new Map<string, DataGridCellCoordinate[]>();
    for (const cell of cells) {
      const rowCells = cellsByRow.get(cell.rowId);
      if (rowCells) rowCells.push(cell);
      else cellsByRow.set(cell.rowId, [cell]);
    }
    const text = [...cellsByRow.entries()]
      .map(([rowId, rowCells]) => {
        const row = rowsByDomId.get(rowId);
        if (!row) return '';
        return rowCells
          .map((cell) => {
            const column = columnsByKey.get(cell.columnKey);
            if (!column) return '';
            return formatDataGridValue(getDataGridColumnValue(row, column));
          })
          .join('\t');
      })
      .join('\n');

    const copied = await copyToClipboard(text);
    if (copied) {
      announceCopiedCells(`Copied ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}`);
      return;
    }
    announceCopiedCells('Copy failed');
  }

  function announceCopiedCells(message: string): void {
    liveRegionMessage = message;
    liveRegionAnnouncementSequence += 1;
  }

  function sortCellsByGridOrder(
    cells: readonly DataGridCellCoordinate[],
  ): DataGridCellCoordinate[] {
    const rowIndexes = new Map(rowDomIds.map((rowId, index) => [rowId, index]));
    const columnIndexes = new Map(columnKeys.map((columnKey, index) => [columnKey, index]));
    return [...cells].sort((left, right) => {
      const leftRowIndex = rowIndexes.get(left.rowId) ?? Number.POSITIVE_INFINITY;
      const rightRowIndex = rowIndexes.get(right.rowId) ?? Number.POSITIVE_INFINITY;
      if (leftRowIndex !== rightRowIndex) return leftRowIndex - rightRowIndex;

      const leftColumnIndex = columnIndexes.get(left.columnKey) ?? Number.POSITIVE_INFINITY;
      const rightColumnIndex = columnIndexes.get(right.columnKey) ?? Number.POSITIVE_INFINITY;
      return leftColumnIndex - rightColumnIndex;
    });
  }

  function handleCellClick(
    event: MouseEvent,
    rowId: string,
    rowDomId: string,
    columnKey: string,
    rowIndex: number,
  ): void {
    requestedActiveRowIndex = rowIndex;
    requestedActiveColumnKey = columnKey;
    selectionState.setActiveCell(
      { rowId: rowDomId, columnKey },
      { extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey },
    );
    updateRowSelection(rowId, event);
    if (!isInteractiveEventTarget(event)) gridElement?.focus({ preventScroll: true });
  }

  function handleCellKeydown(
    event: KeyboardEvent,
    rowId: string,
    rowDomId: string,
    columnKey: string,
    rowIndex: number,
  ): void {
    if (isInteractiveEventTarget(event)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    requestedActiveRowIndex = rowIndex;
    requestedActiveColumnKey = columnKey;
    selectionState.setActiveCell(
      { rowId: rowDomId, columnKey },
      { extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey },
    );
    updateRowSelection(rowId, event);
    gridElement?.focus({ preventScroll: true });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (consumerOnKeydown) {
      (consumerOnKeydown as (event: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('.cinder-data-grid__sort-button')) {
      return;
    }
    if (isInteractiveEventTarget(event)) return;

    if (sortedKeyedRows.length === 0 || columnModel.renderColumns.length === 0) return;

    const action = dataGridKeyToAction(event, {
      activeRowIndex,
      activeColumnIndex,
      rowCount: sortedKeyedRows.length,
      columnCount: columnModel.renderColumns.length,
    });
    if (!action) return;

    event.preventDefault();

    if (action.type === 'move-cell') {
      moveActiveCell(action.rowIndex, action.columnIndex, action.extend);
      return;
    }

    if (action.type === 'select-all') {
      selectionState.selectAll();
      if (selectionMode === 'multiple') {
        setSelectionModel(sortedKeyedRows.map((row) => row.rowId));
      } else if (selectionMode === 'single') {
        const row = sortedKeyedRows[activeRowIndex];
        setSelectionModel(row ? [row.rowId] : []);
      }
      return;
    }

    if (action.type === 'collapse-selection') {
      collapseSelectionToActiveCell();
      return;
    }

    if (action.type === 'select-active-cell') {
      selectActiveCell(event);
      return;
    }

    if (action.type === 'copy-selection') {
      void copySelectedCells();
    }
  }

  function isInteractiveEventTarget(event: Event): boolean {
    if (!(event.target instanceof Element)) return false;
    const interactiveElement = event.target.closest(interactiveDescendantSelector);
    return interactiveElement !== null && interactiveElement !== gridElement;
  }
</script>

<div
  {...rest}
  bind:this={gridElement}
  class={classNames('cinder-data-grid', className)}
  role="grid"
  aria-rowcount={rows.length + 1}
  aria-colcount={columnModel.orderedColumns.length}
  aria-label={resolvedAriaLabel}
  aria-labelledby={resolvedAriaLabelledBy}
  aria-activedescendant={activeCellId}
  aria-multiselectable="true"
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
      {@const rowId = keyedRow.rowId}
      {@const rowDomId = keyedRow.rowDomId}
      {@const rowIndex = visualRowIndex}
      <div
        class={classNames('cinder-data-grid__row', getRowClass(row, rowIndex))}
        role="row"
        aria-rowindex={visualRowIndex + 2}
        aria-label={getResolvedRowAriaLabel(row, rowIndex)}
        aria-selected={selectedRowIds.has(rowId) ? 'true' : undefined}
        data-cinder-selected={selectedRowIds.has(rowId) ? 'true' : undefined}
      >
        {#each columnModel.renderColumns as column (column.key)}
          {@const value = getDataGridColumnValue(row, column)}
          {@const cellId = getCellId(rowDomId, column.key)}
          {@const cellCoordinates = { rowId: rowDomId, columnKey: column.key }}
          {@const isSelectedCell = selectionState.isCellSelected(cellCoordinates)}
          {@const isAnchorCell = selectionState.isAnchorCell(cellCoordinates)}
          <div
            id={cellId}
            class="cinder-data-grid__cell"
            role="gridcell"
            aria-colindex={column.colIndex}
            aria-selected={isSelectedCell ? 'true' : undefined}
            tabindex="-1"
            data-cinder-pin={column.pin}
            data-cinder-active={activeCellId === cellId ? 'true' : undefined}
            data-cinder-selected={isSelectedCell ? 'true' : undefined}
            data-cinder-anchor={isAnchorCell ? 'true' : undefined}
            style={getCellStyle(column)}
            onclick={(event) => handleCellClick(event, rowId, rowDomId, column.key, visualRowIndex)}
            onkeydown={(event) =>
              handleCellKeydown(event, rowId, rowDomId, column.key, visualRowIndex)}
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

{#if mounted}
  <VisuallyHiddenLiveRegion
    class="cinder-data-grid__live-region"
    message={liveRegionMessage}
    announcementSequence={liveRegionAnnouncementSequence}
  />
{/if}
