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
   * @avoidWhen You need sorting, virtualization, resizing, reordering, or editing today — DataGrid does not provide them yet.
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
    getCellCoordinateKey,
    getCellsInRange,
    type DataGridCellCoordinate,
  } from './_internal/geometry.ts';
  import { dataGridKeyToAction } from './_internal/keyboard-model.ts';
  import { DataGridSelectionModel as InternalDataGridSelectionModel } from './_internal/selection-model.svelte.ts';
  import type { DataGridProps, DataGridSelectionModel } from './data-grid.types.ts';

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

  let uncontrolledSelectionModel = $state<DataGridSelectionModel>([]);
  let liveRegionMessage = $state('');

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
  const rowDomIds = $derived(keyedRows.map((row) => row.rowDomId));
  const columnKeys = $derived(columnModel.renderColumns.map((column) => column.key));
  const gridId = $props.id();
  let requestedActiveRowIndex = $state(0);
  let requestedActiveColumnKey = $state<string | undefined>();
  const selectionState = new InternalDataGridSelectionModel({
    rowIds: () => rowDomIds,
    columnKeys: () => columnKeys,
  });
  const activeRowIndex = $derived(
    keyedRows.length > 0 ? Math.min(requestedActiveRowIndex, keyedRows.length - 1) : 0,
  );
  const activeColumnIndex = $derived.by(() => {
    const index = columnModel.renderColumns.findIndex(
      (column) => column.key === requestedActiveColumnKey,
    );
    return index >= 0 ? index : 0;
  });
  const activeRowDomId = $derived(
    keyedRows.length > 0
      ? keyedRows[Math.min(activeRowIndex, keyedRows.length - 1)]?.rowDomId
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
  const resolvedSelectionModel = $derived(selectionModel ?? uncontrolledSelectionModel);
  const selectedRowIds = $derived(new Set(resolvedSelectionModel));
  const hasMultipleSelectedCells = $derived(selectionState.selectedCellCount > 1);
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

  $effect(() => {
    if (!activeCellCoordinates) return;
    if (selectionState.activeCell) return;
    selectionState.setActiveCell(activeCellCoordinates);
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
    if (keyedRows.length === 0 || columnModel.renderColumns.length === 0) return;
    requestedActiveRowIndex = Math.min(Math.max(rowIndex, 0), keyedRows.length - 1);
    requestedActiveColumnKey =
      columnModel.renderColumns[
        Math.min(Math.max(columnIndex, 0), columnModel.renderColumns.length - 1)
      ]?.key;

    const cell = getCellCoordinate(rowIndex, columnIndex);
    if (cell) selectionState.setActiveCell(cell, { extend });
  }

  function setSelectionModel(nextSelectionModel: DataGridSelectionModel): void {
    if (selectionModel !== undefined) selectionModel = nextSelectionModel;
    else uncontrolledSelectionModel = nextSelectionModel;
    onSelectionModelChange?.(nextSelectionModel);
  }

  function updateRowSelection(rowId: string, event: MouseEvent | KeyboardEvent): void {
    if (selectionMode === 'none') return;
    if (selectionMode === 'single') {
      setSelectionModel([rowId]);
      return;
    }

    const isToggle = event.ctrlKey || event.metaKey;
    if (!isToggle) {
      setSelectionModel([rowId]);
      return;
    }

    const nextSelection = new Set(resolvedSelectionModel);
    if (nextSelection.has(rowId)) nextSelection.delete(rowId);
    else nextSelection.add(rowId);
    setSelectionModel([...nextSelection]);
  }

  async function copySelectedCells(): Promise<void> {
    const rangeCells = getCellsInRange(selectionState.range);
    const toggledCells = rowDomIds.flatMap((rowId) =>
      columnKeys.flatMap((columnKey) => {
        const cell = { rowId, columnKey };
        return selectionState.selectedCells.has(getCellCoordinateKey(cell)) ? [cell] : [];
      }),
    );
    const cells =
      rangeCells.length > 0
        ? rangeCells
        : toggledCells.length > 0
          ? toggledCells
          : activeCellCoordinates
            ? [activeCellCoordinates]
            : [];
    if (cells.length === 0) return;

    const rowsByDomId = new Map(keyedRows.map((row) => [row.rowDomId, row.row]));
    const columnsByKey = new Map(columnModel.renderColumns.map((column) => [column.key, column]));
    const rowOrder = [...new Set(cells.map((cell) => cell.rowId))];
    const columnOrderForCopy = [...new Set(cells.map((cell) => cell.columnKey))];
    const text = rowOrder
      .map((rowId) => {
        const row = rowsByDomId.get(rowId);
        if (!row) return '';
        return columnOrderForCopy
          .map((columnKey) => {
            const column = columnsByKey.get(columnKey);
            if (!column) return '';
            return formatDataGridValue(getDataGridColumnValue(row, column));
          })
          .join('\t');
      })
      .join('\n');

    await navigator.clipboard?.writeText(text);
    liveRegionMessage = `Copied ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}`;
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
  }

  function handleCellKeydown(
    event: KeyboardEvent,
    rowId: string,
    rowDomId: string,
    columnKey: string,
    rowIndex: number,
  ): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    requestedActiveRowIndex = rowIndex;
    requestedActiveColumnKey = columnKey;
    selectionState.setActiveCell(
      { rowId: rowDomId, columnKey },
      { extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey },
    );
    updateRowSelection(rowId, event);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (consumerOnKeydown) {
      (consumerOnKeydown as (event: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;

    if (keyedRows.length === 0 || columnModel.renderColumns.length === 0) return;

    const action = dataGridKeyToAction(event, {
      activeRowIndex,
      activeColumnIndex,
      rowCount: keyedRows.length,
      columnCount: columnModel.renderColumns.length,
    });
    if (!action) return;

    event.preventDefault();

    if (action.type === 'move-cell') {
      moveActiveCell(action.rowIndex, action.columnIndex, action.extend);
      const row = keyedRows[Math.min(Math.max(action.rowIndex, 0), keyedRows.length - 1)];
      if (row && event.shiftKey && selectionMode !== 'none') updateRowSelection(row.rowId, event);
      return;
    }

    if (action.type === 'select-all') {
      selectionState.selectAll();
      if (selectionMode !== 'none') setSelectionModel(keyedRows.map((row) => row.rowId));
      return;
    }

    if (action.type === 'collapse-selection') {
      selectionState.collapseToActiveCell();
      return;
    }

    if (action.type === 'copy-selection') {
      void copySelectedCells();
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
  aria-multiselectable={selectionMode === 'multiple' || hasMultipleSelectedCells
    ? 'true'
    : undefined}
  tabindex="0"
  onkeydown={handleKeydown}
  data-cinder-density={density}
  data-cinder-sticky-header={stickyHeader ? 'true' : undefined}
  style:--_cinder-data-grid-template-columns={gridTemplateColumns}
>
  <div class="cinder-data-grid__header-row" role="row" aria-rowindex="1">
    {#each columnModel.renderColumns as column (column.key)}
      <div
        class="cinder-data-grid__header-cell"
        role="columnheader"
        aria-colindex={column.colIndex}
        data-cinder-pin={column.pin}
        style={getCellStyle(column)}
      >
        {#if typeof column.header === 'function'}
          {@render column.header()}
        {:else}
          {column.header}
        {/if}
      </div>
    {/each}
  </div>

  <div class="cinder-data-grid__body" role="rowgroup">
    {#each keyedRows as keyedRow (keyedRow.rowKey)}
      {@const row = keyedRow.row}
      {@const rowId = keyedRow.rowId}
      {@const rowDomId = keyedRow.rowDomId}
      {@const rowIndex = keyedRow.rowIndex}
      <div
        class={classNames('cinder-data-grid__row', getRowClass(row, rowIndex))}
        role="row"
        aria-rowindex={rowIndex + 2}
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
            onclick={(event) => handleCellClick(event, rowId, rowDomId, column.key, rowIndex)}
            onkeydown={(event) => handleCellKeydown(event, rowId, rowDomId, column.key, rowIndex)}
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

<div class="cinder-data-grid__live-region" aria-live="polite" aria-atomic="true">
  {liveRegionMessage}
</div>
