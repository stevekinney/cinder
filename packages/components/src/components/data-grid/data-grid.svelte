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
   * @avoidWhen You need sorting, selection, virtualization, resizing, reordering, or editing today — DataGrid does not provide them yet.
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
  import type { DataGridProps } from './data-grid.types.ts';

  let {
    rows,
    columns,
    getRowId,
    density = 'comfortable',
    stickyHeader = true,
    columnOrder,
    columnSizing,
    columnPinning,
    rowClass,
    getRowAriaLabel,
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  }: DataGridProps<TRow> = $props();

  const columnModel = new DataGridColumnModel<TRow>({
    columns: () => columns,
    columnOrder: () => columnOrder,
    columnSizing: () => columnSizing,
    columnPinning: () => columnPinning,
  });

  const gridTemplateColumns = $derived(
    columnModel.renderColumns.map((column) => `${column.width}px`).join(' '),
  );
  const keyedRows = $derived(
    rows.map((row, rowIndex) => ({
      row,
      rowId: getRowId(row),
      rowIndex,
    })),
  );
  const firstRowId = $derived(keyedRows[0]?.rowId);
  const firstColumnKey = $derived(columnModel.renderColumns[0]?.key);
  const gridId = $props.id();
  let requestedActiveRowIndex = $state(0);
  let requestedActiveColumnKey = $state<string | undefined>();
  const activeRowIndex = $derived(
    keyedRows.length > 0 ? Math.min(requestedActiveRowIndex, keyedRows.length - 1) : 0,
  );
  const activeColumnIndex = $derived.by(() => {
    const index = columnModel.renderColumns.findIndex(
      (column) => column.key === requestedActiveColumnKey,
    );
    return index >= 0 ? index : 0;
  });
  const activeRowId = $derived(
    keyedRows.length > 0
      ? keyedRows[Math.min(activeRowIndex, keyedRows.length - 1)]?.rowId
      : firstRowId,
  );
  const activeCellId = $derived(
    activeRowId !== undefined && firstColumnKey !== undefined
      ? getCellId(activeRowId, columnModel.renderColumns[activeColumnIndex]?.key ?? firstColumnKey)
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

  $effect(() => {
    if (!resolvedAriaLabel && !resolvedAriaLabelledBy && !hasWarnedNoLabel) {
      hasWarnedNoLabel = true;
      devWarn('[cinder-data-grid] DataGrid requires either aria-label or aria-labelledby.');
    }
  });

  function getCellId(rowId: string, columnKey: string): string {
    return `${gridId}-cell-${toDomIdSegment(rowId)}-${toDomIdSegment(columnKey)}`;
  }

  function toDomIdSegment(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/gu, (character) => {
      const codePoint = character.codePointAt(0)?.toString(16) ?? '0';
      return `-${codePoint}-`;
    });
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

  function moveActiveCell(rowIndex: number, columnIndex: number): void {
    if (keyedRows.length === 0 || columnModel.renderColumns.length === 0) return;
    requestedActiveRowIndex = Math.min(Math.max(rowIndex, 0), keyedRows.length - 1);
    requestedActiveColumnKey =
      columnModel.renderColumns[
        Math.min(Math.max(columnIndex, 0), columnModel.renderColumns.length - 1)
      ]?.key;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (keyedRows.length === 0 || columnModel.renderColumns.length === 0) return;

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
        event.ctrlKey ? keyedRows.length - 1 : activeRowIndex,
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
    {#each keyedRows as keyedRow (keyedRow.rowId)}
      {@const row = keyedRow.row}
      {@const rowId = keyedRow.rowId}
      {@const rowIndex = keyedRow.rowIndex}
      <div
        class={classNames('cinder-data-grid__row', getRowClass(row, rowIndex))}
        role="row"
        aria-rowindex={rowIndex + 2}
        aria-label={getRowAriaLabel?.(row, rowIndex)}
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
