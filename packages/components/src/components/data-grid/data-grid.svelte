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
   * @useWhen You need inline cell editing backed by Cinder's own Input, with commit/cancel keyboard behavior handled for you.
   * @useWhen You need opt-in pointer- and keyboard-driven column resizing or reordering (`resizableColumns` / `reorderableColumns`).
   * @useWhen You need opt-in toolbar search/zoom controls, or `zoom` scaling row/header height, column width, and text.
   * @avoidWhen You only need a semantic read-only table — use DataTable or the Table family instead.
   * @related data-table, table
   */
  export type {
    DataGridCellContext,
    DataGridColumnDef,
    DataGridColumnPin,
    DataGridColumnPinning,
    DataGridColumnSizing,
    DataGridDensity,
    DataGridEditType,
    DataGridProps,
    DataGridSelectionMode,
    DataGridSelectionModel,
    DataGridSortComparator,
    DataGridSortDirection,
    DataGridSortModel,
    DataGridSortModelItem,
  } from './data-grid.types.ts';
  export { parseDelimitedText, resolveDelimitedTextColumnKeys } from './parse-delimited-text.ts';
  export type {
    DelimitedTextRow,
    ParseDelimitedTextOptions,
    ParsedDelimitedText,
  } from './parse-delimited-text.ts';
</script>

<script lang="ts" generics="TRow">
  import { tick, untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ZoomIn from 'lucide-svelte/icons/zoom-in';
  import ZoomOut from 'lucide-svelte/icons/zoom-out';
  import { classNames } from '../../utilities/class-names.ts';
  import { copyToClipboard } from '../../utilities/clipboard.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import Button from '../button/button.svelte';
  import Input from '../input/input.svelte';
  import SearchField from '../search-field/search-field.svelte';
  import Toolbar from '../toolbar/toolbar.svelte';
  import ToolbarGroup from '../toolbar/toolbar-group.svelte';
  import ToolbarSpacer from '../toolbar/toolbar-spacer.svelte';
  import {
    DataGridColumnModel,
    getDataGridColumnValue,
    type ResolvedDataGridColumn,
  } from './_internal/column-model.svelte.ts';
  import {
    DataGridEditModel,
    resolveDataGridEditCommitValue,
    resolveDataGridEditType,
    type DataGridEditCellIdentity,
  } from './_internal/edit-model.svelte.ts';
  import { getCellCoordinateKey, type DataGridCellCoordinate } from './_internal/geometry.ts';
  import {
    getKeyboardResizedColumnWidth,
    getPointerResizedColumnWidth,
    moveColumnKeyWithinPinGroup,
    reorderColumnKeyBeforeOrAfter,
  } from './_internal/column-interaction-model.ts';
  import {
    dataGridKeyToAction,
    getAdjacentCellIndex,
    isPrintableCharacterKeydown,
  } from './_internal/keyboard-model.ts';
  import {
    formatDataGridSearchStatus,
    getDataGridSearchMatchKey,
    getDataGridSearchMatches,
    getNextDataGridSearchMatchIndex,
    type DataGridSearchMatch,
  } from './_internal/search-model.ts';
  import { DataGridSelectionModel as InternalDataGridSelectionModel } from './_internal/selection-model.svelte.ts';
  import {
    getActiveDataGridSortModel,
    getNextDataGridSortModel,
    getSortedDataGridRowIndices,
  } from './_internal/sort-model.ts';
  import { DataGridVirtualizationAdapter } from './_internal/virtualization-adapter.svelte.ts';
  import type {
    DataGridColumnPin,
    DataGridColumnSizing,
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

  const defaultVirtualRowHeight = 44;
  const minZoomPercent = 50;
  const maxZoomPercent = 200;
  const defaultZoomPercent = 100;
  const zoomStepPercent = 10;

  let {
    rows,
    columns,
    getRowId,
    density = 'comfortable',
    stickyHeader = true,
    virtualizeRows = false,
    virtualizeColumns = false,
    rowHeight,
    resizableColumns = false,
    reorderableColumns = false,
    columnOrder = $bindable<readonly string[] | undefined>(undefined),
    onColumnOrderChange,
    columnSizing = $bindable<DataGridColumnSizing | undefined>(undefined),
    onColumnSizingChange,
    columnPinning,
    selectionMode = 'none',
    selectionModel = $bindable<DataGridSelectionModel | undefined>(undefined),
    onSelectionModelChange,
    sortModel = $bindable([]),
    onSortModelChange,
    onCellEdit,
    rowClass,
    getRowAriaLabel,
    search = false,
    zoom = $bindable(100),
    onZoomChange,
    zoomControls = false,
    class: className,
    id: consumerId,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onkeydown: consumerOnKeydown,
    ...rest
  }: DataGridProps<TRow> = $props();

  // Live-updating widths from an in-progress pointer resize drag (COR-1131),
  // keyed by column key. Merged over `columnSizing` for rendering only —
  // the drag commits into `columnSizing`/`onColumnSizingChange` on
  // pointerup, mirroring the rest of DataGrid's controlled-prop contract.
  let liveColumnWidths = $state<Record<string, number>>({});
  const effectiveColumnSizing = $derived.by(() => {
    if (Object.keys(liveColumnWidths).length === 0) return columnSizing;
    return { ...columnSizing, ...liveColumnWidths };
  });

  const columnModel = new DataGridColumnModel<TRow>({
    columns: () => columns,
    columnOrder: () => columnOrder,
    columnSizing: () => effectiveColumnSizing,
    columnPinning: () => columnPinning,
  });

  const headerInteractionEnabled = $derived(
    resizableColumns === true || reorderableColumns === true,
  );
  let headerFocusColumnKey = $state<string | undefined>();

  type ColumnResizeDragState = {
    pointerId: number;
    columnKey: string;
    startClientX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number | undefined;
  };
  let resizeDragState = $state<ColumnResizeDragState | undefined>();

  type HeaderCellRect = {
    key: string;
    pin: DataGridColumnPin | undefined;
    left: number;
    right: number;
  };
  type ColumnDragState = {
    pointerId: number;
    draggedKey: string;
    pin: DataGridColumnPin | undefined;
    targetKey: string | undefined;
    dropSide: 'before' | 'after' | undefined;
    rects: readonly HeaderCellRect[];
  };
  let reorderPointerDownState = $state<
    { pointerId: number; columnKey: string; startClientX: number; startClientY: number } | undefined
  >();
  let columnDragState = $state<ColumnDragState | undefined>();
  const columnDragThresholdPx = 4;

  let liveRegionMessage = $state('');
  let renderedLiveRegionMessage = $state('');
  let liveRegionAnnouncementSequence = $state(0);
  let measuredGridWidth = $state<number | undefined>();
  let measuredGridScrollportWidth = $state<number | undefined>();
  let isRightToLeft = $state(false);

  const activeSortModel = $derived(
    getActiveDataGridSortModel(columnModel.orderedColumns, sortModel),
  );
  const sortedRowIndices = $derived(
    getSortedDataGridRowIndices(rows, columnModel.orderedColumns, activeSortModel),
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
  const resolvedRowHeight = $derived(resolveVirtualRowHeight(rowHeight));
  const shouldWarnVirtualRowHeightFallback = $derived(
    virtualizeRows && !isValidVirtualRowHeight(rowHeight),
  );
  // --- Zoom (COR-1139) ---------------------------------------------------
  //
  // `zoomScale` (`resolvedZoomPercent / 100`) is the single multiplier every
  // rendered pixel dimension — row height, column width, and (through the
  // `--_cinder-data-grid-zoom-scale` CSS variable below) header height and
  // cell text size — is scaled by. `columnModel`'s own widths stay in
  // unscaled base pixels throughout (see its module comment); `zoomScale`
  // is only ever applied at render/measurement call sites, never folded
  // into `columnSizing` or `columnModel`, so a resize keeps reporting base
  // widths no matter the current zoom level.
  const resolvedZoomPercent = $derived(resolveZoomPercent(zoom));
  const shouldWarnInvalidZoom = $derived(zoom !== undefined && !isFiniteZoomValue(zoom));
  const zoomScale = $derived(resolvedZoomPercent / 100);
  const scaledRowHeight = $derived(resolvedRowHeight * zoomScale);
  const shouldVirtualizeRows = $derived(virtualizeRows && sortedKeyedRows.length > 0);
  const shouldVirtualizeColumns = $derived(
    virtualizeColumns &&
      columnModel.unpinnedColumns.length > 0 &&
      measuredGridWidth !== undefined &&
      measuredGridWidth > 0 &&
      !isRightToLeft &&
      typeof window !== 'undefined',
  );
  const rowVirtualizer = new DataGridVirtualizationAdapter({
    getScrollElement: () => gridElement ?? null,
    getRowCount: () => sortedKeyedRows.length,
    getRowKey: (index) => sortedKeyedRows[index]?.rowKey ?? index,
    getRowHeight: () => scaledRowHeight,
    getColumnCount: () => columnModel.unpinnedColumns.length,
    getColumnKey: (index) => columnModel.unpinnedColumns[index]?.key ?? index,
    getColumnWidth: (index) => (columnModel.unpinnedColumns[index]?.width ?? 150) * zoomScale,
    getOverscan: () => 5,
    getInitialHeight: () => scaledRowHeight * 10,
    getInitialWidth: () => measuredGridWidth ?? 1_000,
    getScrollPaddingStart: () => getHeaderHeight(),
    getScrollPaddingInlineStart: () => columnModel.leftPinnedWidth * zoomScale,
    getScrollPaddingInlineEnd: () => columnModel.rightPinnedWidth * zoomScale,
  });
  // Keeps the column virtualizer's own measured sizes in sync with resolved
  // column widths (COR-1131). `@tanstack/virtual-core` only recomputes an
  // item's cached size on an explicit resize call, so a controlled
  // `columnSizing` update or a pointer/keyboard resize would otherwise
  // leave the virtualized column tracks and total width stale even though
  // the resized cell's own CSS width is already correct.
  //
  // Gated on `shouldVirtualizeColumns`: `resizeColumn()` subscribes to the
  // underlying `@tanstack/virtual-core` virtualizer, which lazily creates
  // both virtualizers and attaches their `ResizeObserver`/scroll listeners
  // on first subscription. Running this unconditionally would force that
  // eager setup on every DataGrid, including ones that never enable
  // `virtualizeColumns`, breaking the "renders exactly as before" contract
  // for grids that haven't opted in.
  $effect(() => {
    if (!shouldVirtualizeColumns) return;
    columnModel.unpinnedColumns.forEach((column, index) => {
      rowVirtualizer.resizeColumn(index, column.width * zoomScale);
    });
  });
  const observeHeaderSize: Attachment<HTMLElement> = (node) => {
    if (typeof ResizeObserver === 'undefined') return;

    let previousHeight = getElementHeight(node);
    const observer = new ResizeObserver(() => {
      const nextHeight = getElementHeight(node);
      if (nextHeight === previousHeight) return;

      previousHeight = nextHeight;
      rowVirtualizer.refreshMeasurements();
    });
    observer.observe(node);
    return () => observer.disconnect();
  };
  const observeGridSize: Attachment<HTMLElement> = (node) => {
    const updateGridMeasurement = (): void => {
      const rect = node.getBoundingClientRect();
      measuredGridWidth = rect.width || node.clientWidth || undefined;
      measuredGridScrollportWidth = node.clientWidth || rect.width || undefined;
      isRightToLeft = getComputedStyle(node).direction === 'rtl';
    };

    updateGridMeasurement();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateGridMeasurement);
    observer.observe(node);
    return () => observer.disconnect();
  };
  const delegateBodyEvents: Attachment<HTMLElement> = (node) => {
    node.addEventListener('click', handleBodyClick);
    node.addEventListener('dblclick', handleBodyDoubleClick);
    node.addEventListener('keydown', handleBodyKeydown);
    return () => {
      node.removeEventListener('click', handleBodyClick);
      node.removeEventListener('dblclick', handleBodyDoubleClick);
      node.removeEventListener('keydown', handleBodyKeydown);
    };
  };
  const focusEditingInput: Attachment<HTMLInputElement> = (node) => {
    node.focus();
    const cursorPosition = node.value.length;
    try {
      node.setSelectionRange(cursorPosition, cursorPosition);
    } catch {
      // Selection ranges aren't supported for every input `type` (e.g. "number").
    }
  };
  const virtualRows = $derived(rowVirtualizer.virtualRows);
  const virtualColumns = $derived(rowVirtualizer.virtualColumns);
  const virtualColumnLeadingSpacer = $derived(virtualColumns[0]?.start ?? 0);
  const virtualColumnTrailingSpacer = $derived.by(() => {
    const lastColumn = virtualColumns.at(-1);
    if (!lastColumn) return 0;

    return Math.max(0, rowVirtualizer.totalWidth - (lastColumn.start + lastColumn.size));
  });
  const gridContentWidth = $derived(
    shouldVirtualizeColumns
      ? columnModel.leftPinnedWidth * zoomScale +
          rowVirtualizer.totalWidth +
          columnModel.rightPinnedWidth * zoomScale
      : undefined,
  );
  const shouldShowColumnOverflowShadow = $derived(
    gridContentWidth !== undefined &&
      measuredGridScrollportWidth !== undefined &&
      gridContentWidth > measuredGridScrollportWidth,
  );
  const gridTemplateColumns = $derived.by(() => {
    if (!shouldVirtualizeColumns) {
      return columnModel.renderColumns.map((column) => `${column.width * zoomScale}px`).join(' ');
    }

    return [
      ...columnModel.leftPinnedColumns.map((column) => `${column.width * zoomScale}px`),
      `${virtualColumnLeadingSpacer}px`,
      ...virtualColumns.map((item) => `${item.size}px`),
      `${virtualColumnTrailingSpacer}px`,
      ...columnModel.rightPinnedColumns.map((column) => `${column.width * zoomScale}px`),
    ].join(' ');
  });
  const renderedColumns = $derived.by(() => {
    if (!shouldVirtualizeColumns) return columnModel.renderColumns;

    const virtualUnpinnedColumns = virtualColumns.flatMap((item) => {
      const column = columnModel.unpinnedColumns[item.index];
      return column ? [column] : [];
    });

    return [
      ...columnModel.leftPinnedColumns,
      ...virtualUnpinnedColumns,
      ...columnModel.rightPinnedColumns,
    ];
  });
  // `aria-colindex` must reflect each column's 1-based position in the
  // *actual visual left-to-right order* — pinned-left, then unpinned, then
  // pinned-right — for the full column set, matching `aria-colcount`
  // (`columnModel.orderedColumns.length`). That's exactly what
  // `columnModel.renderColumns`' own `renderIndex` already is, since it's
  // built from the same pin-grouped concatenation. `renderedColumns` above
  // is different: when `virtualizeColumns` is on, it's cut down to only the
  // currently-visible unpinned columns, so a virtualized column's own
  // `renderIndex` there would be stale (a position among *visible* columns,
  // not the full set). Looking each column's index up in this map instead
  // of reading `renderIndex` directly off the (possibly virtualized-filtered)
  // rendered column keeps `aria-colindex` correct in both cases, and also
  // fixes it for a non-virtualized grid whose `columns`/`columnOrder` don't
  // already declare pinned columns adjacent to their pin group.
  const ariaColIndexByColumnKey = $derived.by(() => {
    const indexByKey = new Map<string, number>();
    for (const column of columnModel.renderColumns) {
      indexByKey.set(column.key, column.renderIndex);
    }
    return indexByKey;
  });
  function getAriaColIndex(column: ResolvedDataGridColumn<TRow>): number | undefined {
    return ariaColIndexByColumnKey.get(column.key);
  }
  const renderedRows = $derived.by(() => {
    if (!shouldVirtualizeRows) {
      return sortedKeyedRows.map((keyedRow, visualRowIndex) => ({
        keyedRow,
        visualRowIndex,
        start: 0,
        size: scaledRowHeight,
        virtualized: false,
      }));
    }

    return virtualRows.flatMap((item) => {
      const keyedRow = sortedKeyedRows[item.index];
      return keyedRow
        ? [
            {
              keyedRow,
              visualRowIndex: item.index,
              start: item.start,
              size: item.size,
              virtualized: true,
            },
          ]
        : [];
    });
  });
  const bodyHeight = $derived(shouldVirtualizeRows ? `${rowVirtualizer.totalHeight}px` : undefined);
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
  const gridId = $props.id();
  // The grid root only needs a real, renderable `id` when something outside
  // it must reference it — today, only the search toolbar's
  // `aria-controls` (COR-1134). An explicit consumer `id` always wins;
  // otherwise a grid that hasn't opted into `search` renders with no `id`
  // attribute at all, exactly as it did before this feature existed.
  const resolvedGridId = $derived(consumerId ?? (search ? gridId : undefined));
  let requestedActiveRowIndex = $state(0);
  let requestedActiveColumnKey = $state<string | undefined>();
  const selectionState = new InternalDataGridSelectionModel({
    rowIds: () => rowDomIds,
    columnKeys: () => columnKeys,
  });
  const editModel = new DataGridEditModel();
  let suppressNextEditBlur = false;
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
  const canExposeActiveCell = $derived(!(shouldVirtualizeRows && typeof window === 'undefined'));
  const activeCellId = $derived(
    headerFocusColumnKey !== undefined
      ? getHeaderCellId(headerFocusColumnKey)
      : canExposeActiveCell && activeRowDomId !== undefined && firstColumnKey !== undefined
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

  // --- Search (COR-1134–COR-1138) ---------------------------------------
  //
  // `searchQuery` is the SearchField's live, every-keystroke value.
  // `debouncedSearchQuery` only catches up 300ms after typing stops (see the
  // gated $effect below), and every derived value that scans cells —
  // `searchMatches` — reads the debounced value, not the live one, which is
  // what keeps matching from recomputing (and re-highlighting, and
  // rescanning every cell) on every keystroke.
  const searchFieldId = `${gridId}-search`;
  let searchQuery = $state('');
  let debouncedSearchQuery = $state('');
  let currentSearchMatchIndex = $state<number | undefined>();
  // Plain (non-reactive) bookkeeping for the settle effect below — see its
  // comment for why these must not be `$state`.
  let previousDebouncedSearchQuery: string | undefined;
  let currentSearchMatchTrackedKey: string | undefined;

  // Shared by both toolbar groups (`search` and `zoomControls`) — whichever
  // are enabled render inside the same single `<Toolbar>` (COR-1140).
  const toolbarAriaLabel = $derived(
    resolvedAriaLabel ? `${resolvedAriaLabel} toolbar` : 'Grid toolbar',
  );
  const searchFieldAriaLabel = $derived(
    resolvedAriaLabel ? `Search ${resolvedAriaLabel}` : 'Search',
  );

  // --- Toolbar counts and zoom controls (COR-1140) -----------------------
  //
  // Counts use the current row count and the current *visible* column
  // count (`columnModel.renderColumns`, i.e. every column DataGrid is
  // actually rendering — left-pinned, unpinned, and right-pinned together
  // — not the raw `columns` prop length, which would ignore column-model
  // resolution).
  const toolbarRowCount = $derived(rows.length);
  const toolbarColumnCount = $derived(columnModel.renderColumns.length);
  const toolbarCountsText = $derived(
    `${toolbarRowCount} ${toolbarRowCount === 1 ? 'row' : 'rows'}, ${toolbarColumnCount} ${toolbarColumnCount === 1 ? 'column' : 'columns'}`,
  );
  const canZoomOut = $derived(resolvedZoomPercent > minZoomPercent);
  const canZoomIn = $derived(resolvedZoomPercent < maxZoomPercent);

  // Explicitly re-checks `search` (not just relying on callers gating reads)
  // so nothing here ever calls a column's `getValue` while search is off,
  // no matter what else changes (COR-1136).
  const searchMatches = $derived.by((): readonly DataGridSearchMatch[] => {
    if (!search) return [];
    return getDataGridSearchMatches(
      sortedKeyedRows,
      columnModel.renderColumns,
      debouncedSearchQuery,
    );
  });
  const searchMatchKeys = $derived.by(
    () => new Set(searchMatches.map((match) => getDataGridSearchMatchKey(match))),
  );
  const currentSearchMatch = $derived(
    currentSearchMatchIndex !== undefined ? searchMatches[currentSearchMatchIndex] : undefined,
  );
  const currentSearchMatchKey = $derived(
    currentSearchMatch ? getDataGridSearchMatchKey(currentSearchMatch) : undefined,
  );
  // Blank until a search has actually run — "No matches" before the user
  // has typed anything would read as a false negative, not an empty state.
  const searchStatusText = $derived(
    debouncedSearchQuery.trim() === ''
      ? ''
      : formatDataGridSearchStatus(currentSearchMatchIndex, searchMatches.length),
  );

  // Debounce: gated on `search` so a non-search grid never starts this timer
  // (COR-1136). Re-runs on every `searchQuery` change, clearing the previous
  // pending timeout first — the same setTimeout+cleanup shape the existing
  // live-region effect below uses.
  $effect(() => {
    if (!search) return;
    const query = searchQuery;
    const timeoutId = setTimeout(() => {
      debouncedSearchQuery = query;
    }, 300);
    return () => clearTimeout(timeoutId);
  });

  // Sets both the reactive current-match index and the plain tracked key
  // the effect below uses to re-find "the same match" across a recompute
  // that isn't a new search.
  function setCurrentSearchMatch(
    index: number | undefined,
    matches: readonly DataGridSearchMatch[],
  ): void {
    currentSearchMatchIndex = index;
    const match = index !== undefined ? matches[index] : undefined;
    currentSearchMatchTrackedKey = match ? getDataGridSearchMatchKey(match) : undefined;
  }

  // Once the debounced query *actually settles on a new value*, jump to
  // (and announce) the first match — that's the only case that should move
  // the active cell or speak through the live region. `searchMatches` can
  // also recompute for reasons that have nothing to do with the user
  // typing — an edit commit or a sort changes row/column order — and this
  // effect still re-fires then (it reads `searchMatches`), but it must not
  // react the same way: re-jumping the active cell and re-announcing on
  // every unrelated data change would silently steal the user's place
  // mid-navigation (e.g. hop back to match 1 of 12 because someone edited
  // an unrelated cell three rows away). So on that path it only relocates
  // the *same* logical match (by `rowId`/`columnKey`, since its array
  // index may have moved) to keep the current-match highlight accurate,
  // and falls back to no current match if that exact cell stopped
  // matching — never picking a new one on the user's behalf.
  //
  // The `announce()` calls below are wrapped in `untrack()`. `announce`
  // does `liveRegionAnnouncementSequence += 1`, a read-then-write of that
  // same piece of state; called directly inside this effect, the read half
  // makes the effect depend on the very value its write half just changed,
  // which is exactly Svelte's effect_update_depth_exceeded ("an effect
  // reads and writes the same piece of state") — an infinite self-retrigger.
  // `untrack()` keeps the write but stops that read from being recorded as
  // one of this effect's dependencies. The resize/reorder call sites for
  // the same `announce()` don't need this because they run from keydown
  // handlers, not from inside a tracked `$effect`.
  $effect(() => {
    if (!search) return;
    const query = debouncedSearchQuery;
    const matches = searchMatches;
    const isNewSearch = query !== previousDebouncedSearchQuery;
    previousDebouncedSearchQuery = query;

    if (query.trim() === '') {
      setCurrentSearchMatch(undefined, matches);
      return;
    }

    if (!isNewSearch) {
      const trackedIndex = currentSearchMatchTrackedKey
        ? matches.findIndex(
            (match) => getDataGridSearchMatchKey(match) === currentSearchMatchTrackedKey,
          )
        : -1;
      setCurrentSearchMatch(trackedIndex >= 0 ? trackedIndex : undefined, matches);
      return;
    }

    if (matches.length === 0) {
      setCurrentSearchMatch(undefined, matches);
      untrack(() => announce('No matches'));
      return;
    }
    setCurrentSearchMatch(0, matches);
    const firstMatch = matches[0];
    if (firstMatch) moveActiveCell(firstMatch.rowIndex, firstMatch.columnIndex);
    untrack(() => announce(formatDataGridSearchStatus(0, matches.length)));
  });

  function goToSearchMatch(direction: 1 | -1): void {
    if (!search || searchMatches.length === 0) return;
    const nextIndex = getNextDataGridSearchMatchIndex(
      currentSearchMatchIndex,
      searchMatches.length,
      direction,
    );
    setCurrentSearchMatch(nextIndex, searchMatches);
    const match = nextIndex !== undefined ? searchMatches[nextIndex] : undefined;
    if (match) moveActiveCell(match.rowIndex, match.columnIndex);
    announce(formatDataGridSearchStatus(nextIndex, searchMatches.length));
  }

  function handleSearchFieldKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    goToSearchMatch(event.shiftKey ? -1 : 1);
  }

  let hasWarnedNoLabel = false;
  let warnedDuplicateRowIdsSignature: string | undefined;
  let previousActiveCellId: string | undefined;
  let previousActiveVirtualRowIndex: number | undefined;
  let previousActiveVirtualColumnIndex: number | undefined;
  let previousShouldVirtualizeRows = false;
  let previousShouldVirtualizeColumns = false;
  let hasInitializedActiveCell = false;
  let previousSelectionRowIds: readonly string[] | undefined;
  let previousSelectionColumnKeys: readonly string[] | undefined;
  let gridElement: HTMLDivElement | undefined;
  let headerElement: HTMLDivElement | undefined;
  let liveRegionTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let liveRegionVersion = 0;
  let warnedVirtualRowHeightFallback = false;
  let warnedInvalidZoom = false;

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
    if (!shouldWarnVirtualRowHeightFallback || warnedVirtualRowHeightFallback) return;

    warnedVirtualRowHeightFallback = true;
    devWarn(
      '[cinder-data-grid] DataGrid row virtualization is using the default rowHeight of 44px. Pass a positive finite rowHeight to match your row layout.',
    );
  });

  $effect(() => {
    if (!shouldWarnInvalidZoom || warnedInvalidZoom) return;

    warnedInvalidZoom = true;
    devWarn(
      `[cinder-data-grid] DataGrid zoom must be a finite number; received ${JSON.stringify(zoom)}. Falling back to ${defaultZoomPercent}.`,
    );
  });

  $effect(() => {
    const nextMessage = liveRegionMessage;
    void liveRegionAnnouncementSequence;
    const currentVersion = ++liveRegionVersion;

    if (liveRegionTimeoutId) {
      clearTimeout(liveRegionTimeoutId);
      liveRegionTimeoutId = undefined;
    }

    renderedLiveRegionMessage = '';
    if (nextMessage === '') return;

    liveRegionTimeoutId = setTimeout(() => {
      if (liveRegionVersion !== currentVersion) return;
      renderedLiveRegionMessage = nextMessage;
      liveRegionTimeoutId = undefined;
    }, 0);

    return () => {
      if (!liveRegionTimeoutId) return;
      clearTimeout(liveRegionTimeoutId);
      liveRegionTimeoutId = undefined;
    };
  });

  $effect(() => {
    const cellId = activeCellId;
    const activeVirtualRowIndex = activeRowIndex;
    const activeVirtualColumnIndex = getUnpinnedColumnIndex(activeColumnKey);
    const didActiveCellChange = cellId !== previousActiveCellId;
    const didActiveVirtualRowChange = activeVirtualRowIndex !== previousActiveVirtualRowIndex;
    const didActiveVirtualColumnChange =
      activeVirtualColumnIndex !== previousActiveVirtualColumnIndex;
    const didEnableRowVirtualization = shouldVirtualizeRows && !previousShouldVirtualizeRows;
    const didEnableColumnVirtualization =
      shouldVirtualizeColumns && !previousShouldVirtualizeColumns;
    if (
      cellId === undefined ||
      (!didActiveCellChange &&
        !didActiveVirtualRowChange &&
        !didActiveVirtualColumnChange &&
        !didEnableRowVirtualization &&
        !didEnableColumnVirtualization)
    ) {
      previousActiveCellId = cellId;
      previousActiveVirtualRowIndex = activeVirtualRowIndex;
      previousActiveVirtualColumnIndex = activeVirtualColumnIndex;
      previousShouldVirtualizeRows = shouldVirtualizeRows;
      previousShouldVirtualizeColumns = shouldVirtualizeColumns;
      return;
    }

    if (!hasInitializedActiveCell) {
      hasInitializedActiveCell = true;
      previousActiveCellId = cellId;
      previousActiveVirtualRowIndex = activeVirtualRowIndex;
      previousActiveVirtualColumnIndex = activeVirtualColumnIndex;
      previousShouldVirtualizeRows = shouldVirtualizeRows;
      previousShouldVirtualizeColumns = shouldVirtualizeColumns;
      return;
    }

    previousActiveCellId = cellId;
    previousActiveVirtualRowIndex = activeVirtualRowIndex;
    previousActiveVirtualColumnIndex = activeVirtualColumnIndex;
    previousShouldVirtualizeRows = shouldVirtualizeRows;
    previousShouldVirtualizeColumns = shouldVirtualizeColumns;
    if (shouldVirtualizeRows && (didActiveVirtualRowChange || didEnableRowVirtualization)) {
      rowVirtualizer.scrollToRow(activeRowIndex);
    }
    if (
      shouldVirtualizeColumns &&
      (didActiveVirtualColumnChange || didEnableColumnVirtualization) &&
      activeVirtualColumnIndex !== undefined
    ) {
      rowVirtualizer.scrollToColumn(activeVirtualColumnIndex);
    }
    if (didActiveCellChange) void scrollActiveCellIntoView(cellId);
  });

  $effect(() => {
    const previousRowIds = previousSelectionRowIds;
    const previousColumnKeys = previousSelectionColumnKeys;
    const isInitialSelectionReconciliation =
      previousRowIds === undefined || previousColumnKeys === undefined;
    const didSelectionGeometryChange =
      !isInitialSelectionReconciliation &&
      (didStringArrayChange(previousRowIds, rowDomIds) ||
        didStringArrayChange(previousColumnKeys, columnKeys));
    previousSelectionRowIds = rowDomIds;
    previousSelectionColumnKeys = columnKeys;
    if (!isInitialSelectionReconciliation && !didSelectionGeometryChange) return;

    selectionState.reconcile(activeCellCoordinates);
    editModel.reconcile(rowDomIds, columnKeys);
    if (!didSelectionGeometryChange) return;

    syncRequestedActiveCell();
  });

  function syncRequestedActiveCell(): void {
    const activeCell = selectionState.activeCell;
    if (!activeCell) return;

    const nextActiveRowIndex = rowDomIds.indexOf(activeCell.rowId);
    if (nextActiveRowIndex >= 0 && requestedActiveRowIndex !== nextActiveRowIndex) {
      requestedActiveRowIndex = nextActiveRowIndex;
    }
    if (requestedActiveColumnKey !== activeCell.columnKey) {
      requestedActiveColumnKey = activeCell.columnKey;
    }
  }

  function didStringArrayChange(
    previousValues: readonly string[],
    nextValues: readonly string[],
  ): boolean {
    if (previousValues.length !== nextValues.length) return true;
    return previousValues.some((value, index) => value !== nextValues[index]);
  }

  function getCellId(rowId: string, columnKey: string): string {
    return `${gridId}-cell-r-${toDomIdSegment(rowId)}-c-${toDomIdSegment(columnKey)}`;
  }

  function getHeaderCellId(columnKey: string): string {
    return `${gridId}-header-c-${toDomIdSegment(columnKey)}`;
  }

  function toDomIdSegment(value: string): string {
    const segment = Array.from(value, (character) => character.codePointAt(0)?.toString(16) ?? '0');
    return segment.length > 0 ? segment.join('_') : 'empty';
  }

  function isValidVirtualRowHeight(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  function resolveVirtualRowHeight(value: number | undefined): number {
    return isValidVirtualRowHeight(value) ? value : defaultVirtualRowHeight;
  }

  function isFiniteZoomValue(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  // A finite value out of `[minZoomPercent, maxZoomPercent]` is clamped
  // into range (the way column resize clamps to `minWidth`/`maxWidth`); a
  // non-finite value (`NaN`, `Infinity`, …) is invalid and falls back to
  // `defaultZoomPercent`, the same dev-warn-and-fall-back pattern
  // `resolveVirtualRowHeight` uses for `rowHeight`.
  function resolveZoomPercent(value: number | undefined): number {
    if (!isFiniteZoomValue(value)) return defaultZoomPercent;
    return Math.min(Math.max(value, minZoomPercent), maxZoomPercent);
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
    const customProperties = [
      `--_cinder-data-grid-column-width: ${column.width * zoomScale}px`,
      `grid-column: ${getCellGridColumn(column)}`,
    ];
    if (column.pin === 'left') {
      customProperties.push(
        `--_cinder-data-grid-pin-left-offset: ${column.pinOffset * zoomScale}px`,
      );
    }
    if (column.pin === 'right') {
      customProperties.push(
        `--_cinder-data-grid-pin-right-offset: ${column.pinOffset * zoomScale}px`,
      );
    }
    return customProperties.join('; ');
  }

  function getRowStyle(row: {
    virtualized: boolean;
    start: number;
    size: number;
  }): string | undefined {
    if (!row.virtualized) return undefined;

    return [
      `--_cinder-data-grid-row-translate-y: ${row.start}px`,
      `--_cinder-data-grid-row-height: ${row.size}px`,
    ].join('; ');
  }

  function getHeaderHeight(): number {
    return headerElement ? getElementHeight(headerElement) : 0;
  }

  function getElementHeight(element: HTMLElement): number {
    const offsetHeight = element.offsetHeight;
    if (offsetHeight > 0) return offsetHeight;

    return element.getBoundingClientRect().height || 0;
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

  function handleColumnHeaderClick(
    column: ResolvedDataGridColumn<TRow>,
    event: { shiftKey: boolean },
  ): void {
    if (!column.sortable) return;

    const nextSortModel = getNextDataGridSortModel(activeSortModel, column.key, event.shiftKey);
    sortModel = nextSortModel;
    onSortModelChange?.(nextSortModel);
  }

  function getColumnHeaderLabel(column: ResolvedDataGridColumn<TRow>): string {
    return typeof column.header === 'string' ? column.header : column.key;
  }

  function canResizeColumn(column: ResolvedDataGridColumn<TRow>): boolean {
    return resizableColumns === true && column.resizable !== false;
  }

  function commitColumnWidth(columnKey: string, width: number): void {
    const nextSizing: DataGridColumnSizing = { ...columnSizing, [columnKey]: width };
    columnSizing = nextSizing;
    onColumnSizingChange?.(nextSizing);
  }

  function commitColumnOrder(nextOrder: readonly string[]): void {
    columnOrder = nextOrder;
    onColumnOrderChange?.(nextOrder);
  }

  function announce(message: string): void {
    liveRegionMessage = message;
    liveRegionAnnouncementSequence += 1;
  }

  // --- Zoom controls (COR-1140) ------------------------------------------

  function setZoom(nextZoomPercent: number): void {
    const clampedZoomPercent = resolveZoomPercent(nextZoomPercent);
    if (clampedZoomPercent === resolvedZoomPercent) return;

    zoom = clampedZoomPercent;
    onZoomChange?.(clampedZoomPercent);
    announce(`Zoom ${clampedZoomPercent}%`);
  }

  function stepZoom(direction: 1 | -1): void {
    setZoom(resolvedZoomPercent + direction * zoomStepPercent);
  }

  // --- Pointer resize (COR-1131) ---------------------------------------

  function handleResizeHandlePointerDown(
    event: PointerEvent,
    column: ResolvedDataGridColumn<TRow>,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    resizeDragState = {
      pointerId: event.pointerId,
      columnKey: column.key,
      startClientX: event.clientX,
      startWidth: column.width,
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
    };
  }

  function handleResizeHandlePointerMove(event: PointerEvent): void {
    if (!resizeDragState || event.pointerId !== resizeDragState.pointerId) return;
    event.preventDefault();
    const rawDeltaX = event.clientX - resizeDragState.startClientX;
    const deltaX = isRightToLeft ? -rawDeltaX : rawDeltaX;
    // `resizeDragState.startWidth` and the column's min/max are unscaled
    // base pixels (COR-1139) but `deltaX` is a screen-pixel pointer delta —
    // at zoom !== 100% the handle itself renders `zoomScale` px on screen
    // per base px, so dividing here keeps the handle tracking the pointer
    // one-to-one instead of the column growing/shrinking faster or slower
    // than the drag.
    const nextWidth = getPointerResizedColumnWidth(
      resizeDragState.startWidth,
      deltaX / zoomScale,
      resizeDragState.minWidth,
      resizeDragState.maxWidth,
    );
    liveColumnWidths = { [resizeDragState.columnKey]: nextWidth };
  }

  function handleResizeHandlePointerUp(event: PointerEvent): void {
    if (!resizeDragState || event.pointerId !== resizeDragState.pointerId) return;
    const { columnKey, startWidth } = resizeDragState;
    const finalWidth = liveColumnWidths[columnKey] ?? startWidth;
    resizeDragState = undefined;
    liveColumnWidths = {};
    if (finalWidth !== startWidth) commitColumnWidth(columnKey, finalWidth);
    // Setting `headerFocusColumnKey` alone only moves `aria-activedescendant`
    // — that relationship only means anything to AT while the grid itself
    // has real DOM focus (COR-1145). A pointer-only resize (no prior cell
    // click) would otherwise finish with `aria-activedescendant` pointing at
    // the header while focus was still wherever it started (often nowhere),
    // silently breaking both the announcement and subsequent keyboard input.
    if (headerInteractionEnabled) {
      headerFocusColumnKey = columnKey;
      gridElement?.focus({ preventScroll: true });
    }
  }

  // --- Pointer reorder (COR-1132) ---------------------------------------

  function getHeaderCellRects(): HeaderCellRect[] {
    if (!headerElement) return [];
    const cells = headerElement.querySelectorAll<HTMLElement>('.cinder-data-grid__header-cell');
    return Array.from(cells).flatMap((cell) => {
      const key = cell.dataset['cinderColumnKey'];
      if (key === undefined) return [];
      const rect = cell.getBoundingClientRect();
      const pin = columnModel.renderColumns.find((column) => column.key === key)?.pin;
      return [{ key, pin, left: rect.left, right: rect.right }];
    });
  }

  function updateColumnDragTarget(clientX: number): void {
    if (!columnDragState) return;
    const candidates = columnDragState.rects.filter(
      (rect) => rect.pin === columnDragState?.pin && rect.key !== columnDragState?.draggedKey,
    );
    if (candidates.length === 0) {
      columnDragState = { ...columnDragState, targetKey: undefined, dropSide: undefined };
      return;
    }

    let closest = candidates[0]!;
    let closestDistance = Math.abs(clientX - (closest.left + closest.right) / 2);
    for (const rect of candidates) {
      const distance = Math.abs(clientX - (rect.left + rect.right) / 2);
      if (distance < closestDistance) {
        closest = rect;
        closestDistance = distance;
      }
    }

    const midpoint = (closest.left + closest.right) / 2;
    // `dropSide` names the resulting *array-order* position ('before' or
    // 'after' `closest.key`), which `reorderColumnKeyBeforeOrAfter` expects.
    // In RTL, the first key in that array renders at the physical *right*,
    // so a pointer physically left of the target's midpoint lands *after*
    // it in order — the mirror image of LTR. Without this, a right-to-left
    // drag would land the dropped column on the opposite side from where
    // the pointer visually is, inverted the same way pointer-resize's delta
    // would be without its own RTL adjustment.
    const isPhysicallyBeforeMidpoint = clientX < midpoint;
    const dropSide: 'before' | 'after' = isRightToLeft
      ? isPhysicallyBeforeMidpoint
        ? 'after'
        : 'before'
      : isPhysicallyBeforeMidpoint
        ? 'before'
        : 'after';
    columnDragState = { ...columnDragState, targetKey: closest.key, dropSide };
  }

  function handleHeaderCellPointerDown(
    event: PointerEvent,
    column: ResolvedDataGridColumn<TRow>,
  ): void {
    if (!reorderableColumns) return;
    if (
      event.target instanceof Element &&
      event.target.closest('.cinder-data-grid__resize-handle')
    ) {
      return;
    }
    reorderPointerDownState = {
      pointerId: event.pointerId,
      columnKey: column.key,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  function handleHeaderCellPointerMove(event: PointerEvent): void {
    if (columnDragState && columnDragState.pointerId === event.pointerId) {
      event.preventDefault();
      updateColumnDragTarget(event.clientX);
      return;
    }

    if (!reorderPointerDownState || reorderPointerDownState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - reorderPointerDownState.startClientX;
    const deltaY = event.clientY - reorderPointerDownState.startClientY;
    if (Math.abs(deltaX) < columnDragThresholdPx && Math.abs(deltaY) < columnDragThresholdPx)
      return;

    const draggedColumn = columnModel.renderColumns.find(
      (column) => column.key === reorderPointerDownState?.columnKey,
    );
    reorderPointerDownState = undefined;
    if (!draggedColumn) return;

    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    columnDragState = {
      pointerId: event.pointerId,
      draggedKey: draggedColumn.key,
      pin: draggedColumn.pin,
      targetKey: undefined,
      dropSide: undefined,
      rects: getHeaderCellRects(),
    };
    updateColumnDragTarget(event.clientX);
  }

  function handleHeaderCellPointerUp(event: PointerEvent): void {
    if (reorderPointerDownState?.pointerId === event.pointerId) reorderPointerDownState = undefined;
    if (!columnDragState || columnDragState.pointerId !== event.pointerId) return;

    const { draggedKey, targetKey, dropSide } = columnDragState;
    columnDragState = undefined;
    if (targetKey === undefined || dropSide === undefined) return;

    const orderedKeys = columnModel.orderedColumns.map((column) => column.key);
    const pinByKey = new Map(columnModel.orderedColumns.map((column) => [column.key, column.pin]));
    const nextOrder = reorderColumnKeyBeforeOrAfter(
      orderedKeys,
      pinByKey,
      draggedKey,
      targetKey,
      dropSide,
    );
    if (!nextOrder) return;

    commitColumnOrder(nextOrder);
    // See the matching comment in `handleResizeHandlePointerUp` — a
    // pointer-only reorder needs the same real-focus fix so
    // `aria-activedescendant` is live and keyboard input keeps working
    // immediately after the drop (COR-1145).
    if (headerInteractionEnabled) {
      headerFocusColumnKey = draggedKey;
      gridElement?.focus({ preventScroll: true });
    }
  }

  // --- Keyboard resize and reorder (COR-1133) ---------------------------

  function enterHeaderFocus(columnKey: string | undefined): void {
    if (columnKey === undefined) return;
    headerFocusColumnKey = columnKey;
  }

  function moveHeaderFocus(direction: 1 | -1): void {
    const headerColumns = columnModel.renderColumns;
    const index = headerColumns.findIndex((column) => column.key === headerFocusColumnKey);
    if (index < 0) return;
    const nextIndex = Math.min(Math.max(index + direction, 0), headerColumns.length - 1);
    headerFocusColumnKey = headerColumns[nextIndex]?.key;
  }

  function resizeHeaderColumn(column: ResolvedDataGridColumn<TRow>, direction: 1 | -1): void {
    const nextWidth = getKeyboardResizedColumnWidth(
      column.width,
      direction,
      column.minWidth,
      column.maxWidth,
    );
    if (nextWidth === column.width) return;
    commitColumnWidth(column.key, nextWidth);
    announce(`${getColumnHeaderLabel(column)} column resized to ${Math.round(nextWidth)} pixels`);
  }

  function moveHeaderColumn(column: ResolvedDataGridColumn<TRow>, direction: 1 | -1): void {
    const orderedKeys = columnModel.orderedColumns.map((candidate) => candidate.key);
    const pinByKey = new Map(
      columnModel.orderedColumns.map((candidate) => [candidate.key, candidate.pin]),
    );
    const nextOrder = moveColumnKeyWithinPinGroup(orderedKeys, pinByKey, column.key, direction);
    if (!nextOrder) return;

    commitColumnOrder(nextOrder);
    const groupKeys = nextOrder.filter((key) => pinByKey.get(key) === column.pin);
    const position = groupKeys.indexOf(column.key) + 1;
    announce(`${getColumnHeaderLabel(column)} column moved to position ${position}`);
  }

  function handleHeaderFocusKeydown(event: KeyboardEvent): void {
    const column = columnModel.renderColumns.find(
      (candidate) => candidate.key === headerFocusColumnKey,
    );
    if (!column) {
      headerFocusColumnKey = undefined;
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Escape') {
      event.preventDefault();
      headerFocusColumnKey = undefined;
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction: 1 | -1 = event.key === 'ArrowRight' ? 1 : -1;
      const isCommand = event.ctrlKey || event.metaKey;

      if (event.shiftKey && isCommand) {
        if (!reorderableColumns) return;
        event.preventDefault();
        moveHeaderColumn(column, direction);
        return;
      }

      if (event.shiftKey) {
        if (!resizableColumns || !canResizeColumn(column)) return;
        event.preventDefault();
        resizeHeaderColumn(column, direction);
        return;
      }

      event.preventDefault();
      moveHeaderFocus(direction);
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && column.sortable) {
      event.preventDefault();
      handleColumnHeaderClick(column, event);
    }
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

  function getUnpinnedColumnIndex(columnKey: string | undefined): number | undefined {
    if (columnKey === undefined) return undefined;
    const index = columnModel.unpinnedColumns.findIndex((column) => column.key === columnKey);
    return index >= 0 ? index : undefined;
  }

  function getCellGridColumn(column: ResolvedDataGridColumn<TRow>): number {
    if (!shouldVirtualizeColumns) return column.renderIndex;

    const leftPinnedCount = columnModel.leftPinnedColumns.length;
    if (column.pin === 'left') {
      const leftPinnedIndex = columnModel.leftPinnedColumns.findIndex(
        (item) => item.key === column.key,
      );
      return Math.max(0, leftPinnedIndex) + 1;
    }

    const visibleUnpinnedIndex = virtualColumns.findIndex((item) => item.key === column.key);
    if (visibleUnpinnedIndex >= 0) return leftPinnedCount + 2 + visibleUnpinnedIndex;

    const rightPinnedIndex = columnModel.rightPinnedColumns.findIndex(
      (item) => item.key === column.key,
    );
    return leftPinnedCount + 2 + virtualColumns.length + 1 + Math.max(0, rightPinnedIndex);
  }

  async function scrollActiveCellIntoView(cellId: string): Promise<void> {
    await tick();
    document.getElementById(cellId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
    const hasCellSelection = selectionState.selectedCellCoordinates.length > 0;
    const hasRowSelection = resolvedSelectionModel.length > 0;
    if (!hasCellSelection && !hasRowSelection) return;
    if (hasCellSelection) selectionState.collapseToActiveCell();
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
    const sortedCells = [...cells];
    sortedCells.sort((left, right) => {
      const leftRowIndex = rowIndexes.get(left.rowId) ?? Number.POSITIVE_INFINITY;
      const rightRowIndex = rowIndexes.get(right.rowId) ?? Number.POSITIVE_INFINITY;
      if (leftRowIndex !== rightRowIndex) return leftRowIndex - rightRowIndex;

      const leftColumnIndex = columnIndexes.get(left.columnKey) ?? Number.POSITIVE_INFINITY;
      const rightColumnIndex = columnIndexes.get(right.columnKey) ?? Number.POSITIVE_INFINITY;
      return leftColumnIndex - rightColumnIndex;
    });
    return sortedCells;
  }

  function handleCellClick(
    event: MouseEvent,
    rowId: string,
    rowDomId: string,
    columnKey: string,
    rowIndex: number,
  ): void {
    headerFocusColumnKey = undefined;
    requestedActiveRowIndex = rowIndex;
    requestedActiveColumnKey = columnKey;
    selectionState.setActiveCell(
      { rowId: rowDomId, columnKey },
      { extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey },
    );
    updateRowSelection(rowId, event);
    if (!isInteractiveEventTarget(event)) gridElement?.focus({ preventScroll: true });
  }

  function handleBodyClick(event: MouseEvent): void {
    const cell = getCellEventDetail(event);
    if (!cell) return;
    handleCellClick(event, cell.rowId, cell.rowDomId, cell.columnKey, cell.rowIndex);
  }

  function handleBodyDoubleClick(event: MouseEvent): void {
    const cell = getCellEventDetail(event);
    if (!cell) return;
    beginEditCell(cell.rowDomId, cell.columnKey);
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

  function handleBodyKeydown(event: KeyboardEvent): void {
    const cell = getCellEventDetail(event);
    if (!cell) return;
    handleCellKeydown(event, cell.rowId, cell.rowDomId, cell.columnKey, cell.rowIndex);
  }

  function getCellEventDetail(
    event: Event,
  ): { rowId: string; rowDomId: string; columnKey: string; rowIndex: number } | undefined {
    if (!(event.target instanceof Element)) return undefined;
    const cell = event.target.closest<HTMLElement>('.cinder-data-grid__cell');
    if (!cell) return undefined;

    const { cinderRowId, cinderRowDomId, cinderColumnKey, cinderRowIndex } = cell.dataset;
    const rowIndex = Number(cinderRowIndex);
    if (
      cinderRowId === undefined ||
      cinderRowDomId === undefined ||
      cinderColumnKey === undefined ||
      !Number.isInteger(rowIndex)
    ) {
      return undefined;
    }

    return {
      rowId: cinderRowId,
      rowDomId: cinderRowDomId,
      columnKey: cinderColumnKey,
      rowIndex,
    };
  }

  function getEditingInputId(cell: DataGridEditCellIdentity): string {
    return `${getCellId(cell.rowKey, cell.columnKey)}-editor`;
  }

  function beginEditCell(rowKey: string, columnKey: string, initialDraft?: string): void {
    if (editModel.editingCell) return;
    const column = columnModel.renderColumns.find((item) => item.key === columnKey);
    if (!column?.editable) return;
    const rowRecord = keyedRows.find((item) => item.rowKey === rowKey);
    if (!rowRecord) return;

    const value = getDataGridColumnValue(rowRecord.row, column);
    const draft = initialDraft ?? formatDataGridValue(value);
    editModel.begin({ rowKey, columnKey }, draft, value);
  }

  function endEditing(refocusGrid: boolean): void {
    suppressNextEditBlur = true;
    if (refocusGrid) gridElement?.focus({ preventScroll: true });
    editModel.end();
  }

  function cancelEdit(): void {
    if (!editModel.editingCell) return;
    endEditing(true);
  }

  function commitEdit(options: {
    refocusGrid: boolean;
    moveToNextRow?: boolean;
    moveTabDirection?: number;
  }): void {
    const cell = editModel.editingCell;
    if (!cell) return;

    const rowRecord = keyedRows.find((item) => item.rowKey === cell.rowKey);
    const column = columnModel.renderColumns.find((item) => item.key === cell.columnKey);
    if (rowRecord && column) {
      const editType = resolveDataGridEditType(column.editType, editModel.originalValue);
      const result = resolveDataGridEditCommitValue(editType, editModel.draftValue);
      if (result.committed) onCellEdit?.(rowRecord.row, column.key, result.value);
    }

    const rowIndex = sortedKeyedRows.findIndex((item) => item.rowKey === cell.rowKey);
    const columnIndex = columnModel.renderColumns.findIndex((item) => item.key === cell.columnKey);
    if (options.moveToNextRow && rowIndex >= 0 && columnIndex >= 0) {
      moveActiveCell(rowIndex + 1, columnIndex);
    } else if (options.moveTabDirection !== undefined && rowIndex >= 0 && columnIndex >= 0) {
      const target = getAdjacentCellIndex(
        rowIndex,
        columnIndex,
        columnModel.renderColumns.length,
        sortedKeyedRows.length,
        options.moveTabDirection,
      );
      if (target) moveActiveCell(target.rowIndex, target.columnIndex);
    }

    endEditing(options.refocusGrid);
  }

  function handleEditInputBlur(cell: DataGridEditCellIdentity): void {
    if (suppressNextEditBlur) {
      suppressNextEditBlur = false;
      return;
    }
    if (!editModel.isEditing(cell)) return;
    commitEdit({ refocusGrid: false });
  }

  function handleEditingKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      commitEdit({ refocusGrid: true, moveToNextRow: true });
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      commitEdit({ refocusGrid: true, moveTabDirection: event.shiftKey ? -1 : 1 });
    }
    // Every other key (arrows, Home/End, PageUp/PageDown, printable
    // characters, ...) is intentionally left alone so it reaches the
    // editing Input's own text cursor instead of grid navigation.
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (consumerOnKeydown) {
      (consumerOnKeydown as (event: KeyboardEvent) => void)(event);
    }
    if (event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('.cinder-data-grid__sort-button')) {
      return;
    }

    if (editModel.editingCell) {
      handleEditingKeydown(event);
      return;
    }

    if (isInteractiveEventTarget(event)) return;

    if (headerFocusColumnKey !== undefined) {
      handleHeaderFocusKeydown(event);
      return;
    }

    if (sortedKeyedRows.length === 0 || columnModel.renderColumns.length === 0) return;

    const activeColumn = columnModel.renderColumns[activeColumnIndex];
    if (activeColumn?.editable && activeRowDomId !== undefined) {
      if (event.key === 'Enter') {
        event.preventDefault();
        beginEditCell(activeRowDomId, activeColumn.key);
        return;
      }
      if (isPrintableCharacterKeydown(event)) {
        event.preventDefault();
        beginEditCell(activeRowDomId, activeColumn.key, event.key);
        return;
      }
    }

    if (
      headerInteractionEnabled &&
      event.key === 'ArrowUp' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      activeRowIndex === 0
    ) {
      event.preventDefault();
      enterHeaderFocus(activeColumnKey);
      return;
    }

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
      syncRequestedActiveCell();
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

{#if search || zoomControls}
  <Toolbar class="cinder-data-grid__toolbar" aria-label={toolbarAriaLabel}>
    {#if search}
      <ToolbarGroup class="cinder-data-grid__toolbar-search-group">
        <SearchField
          id={searchFieldId}
          bind:value={searchQuery}
          placeholder="Search"
          aria-label={searchFieldAriaLabel}
          aria-controls={resolvedGridId}
          onkeydown={handleSearchFieldKeydown}
        />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Previous match"
          disabled={searchMatches.length === 0}
          onclick={() => goToSearchMatch(-1)}><ChevronLeft aria-hidden="true" /></Button
        >
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Next match"
          disabled={searchMatches.length === 0}
          onclick={() => goToSearchMatch(1)}><ChevronRight aria-hidden="true" /></Button
        >
        <span class="cinder-data-grid__search-status">{searchStatusText}</span>
      </ToolbarGroup>
    {/if}
    {#if zoomControls}
      <ToolbarGroup class="cinder-data-grid__toolbar-zoom-group">
        <span class="cinder-data-grid__toolbar-counts">{toolbarCountsText}</span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Zoom out"
          disabled={!canZoomOut}
          onclick={() => stepZoom(-1)}><ZoomOut aria-hidden="true" /></Button
        >
        <span class="cinder-data-grid__zoom-level">{resolvedZoomPercent}%</span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Zoom in"
          disabled={!canZoomIn}
          onclick={() => stepZoom(1)}><ZoomIn aria-hidden="true" /></Button
        >
      </ToolbarGroup>
    {/if}
    <ToolbarSpacer />
  </Toolbar>
{/if}

<div
  {...rest}
  bind:this={gridElement}
  id={resolvedGridId}
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
  data-cinder-virtualized-rows={shouldVirtualizeRows ? 'true' : undefined}
  data-cinder-virtualized-columns={shouldVirtualizeColumns ? 'true' : undefined}
  data-cinder-column-overflow={shouldShowColumnOverflowShadow ? 'true' : undefined}
  style:--_cinder-data-grid-template-columns={gridTemplateColumns}
  style:--_cinder-data-grid-content-width={gridContentWidth === undefined
    ? undefined
    : `${gridContentWidth}px`}
  style:--_cinder-data-grid-zoom-scale={zoomScale}
  {@attach rowVirtualizer.mountScrollContainer}
  {@attach observeGridSize}
>
  <div
    bind:this={headerElement}
    class="cinder-data-grid__header-row"
    role="row"
    aria-rowindex="1"
    {@attach observeHeaderSize}
  >
    {#each renderedColumns as column (column.key)}
      {@const sortItem = getColumnSortModelItem(column.key)}
      {@const sortPriority = getColumnSortPriority(column.key)}
      <div
        id={getHeaderCellId(column.key)}
        class="cinder-data-grid__header-cell"
        role="columnheader"
        tabindex="-1"
        aria-colindex={getAriaColIndex(column)}
        aria-sort={column.sortable ? getHeaderAriaSort(column, sortItem) : undefined}
        data-cinder-pin={column.pin}
        data-cinder-sortable={column.sortable ? 'true' : undefined}
        data-cinder-sort-direction={sortItem?.direction}
        data-cinder-column-key={column.key}
        data-cinder-header-active={headerFocusColumnKey === column.key ? 'true' : undefined}
        data-cinder-drag-source={columnDragState?.draggedKey === column.key ? 'true' : undefined}
        data-cinder-drop-indicator={columnDragState?.targetKey === column.key
          ? columnDragState.dropSide
          : undefined}
        style={getCellStyle(column)}
        onpointerdown={(event) => handleHeaderCellPointerDown(event, column)}
        onpointermove={handleHeaderCellPointerMove}
        onpointerup={handleHeaderCellPointerUp}
        onpointercancel={handleHeaderCellPointerUp}
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
        {#if canResizeColumn(column)}
          <div
            class="cinder-data-grid__resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${getColumnHeaderLabel(column)} column`}
            aria-valuenow={Math.round(column.width)}
            aria-valuemin={Math.round(column.minWidth)}
            aria-valuemax={Number.isFinite(column.maxWidth)
              ? Math.round(column.maxWidth ?? 0)
              : undefined}
            data-cinder-resize-handle
            onpointerdown={(event) => handleResizeHandlePointerDown(event, column)}
            onpointermove={handleResizeHandlePointerMove}
            onpointerup={handleResizeHandlePointerUp}
            onpointercancel={handleResizeHandlePointerUp}
          ></div>
        {/if}
      </div>
    {/each}
  </div>

  <div
    class="cinder-data-grid__body"
    role="rowgroup"
    style:height={bodyHeight}
    data-cinder-virtualized={shouldVirtualizeRows ? 'true' : undefined}
    {@attach delegateBodyEvents}
  >
    {#each renderedRows as renderedRow (renderedRow.keyedRow.rowKey)}
      {@const keyedRow = renderedRow.keyedRow}
      {@const row = keyedRow.row}
      {@const rowId = keyedRow.rowId}
      {@const rowDomId = keyedRow.rowDomId}
      {@const rowIndex = renderedRow.visualRowIndex}
      <div
        class={classNames('cinder-data-grid__row', getRowClass(row, rowIndex))}
        role="row"
        aria-rowindex={rowIndex + 2}
        aria-label={getResolvedRowAriaLabel(row, rowIndex)}
        aria-selected={selectedRowIds.has(rowId) ? 'true' : undefined}
        data-cinder-selected={selectedRowIds.has(rowId) ? '' : undefined}
        data-cinder-virtual-index={rowIndex}
        style={getRowStyle(renderedRow)}
      >
        {#each renderedColumns as column (column.key)}
          {@const value = getDataGridColumnValue(row, column)}
          {@const cellId = getCellId(rowDomId, column.key)}
          {@const cellCoordinates = { rowId: rowDomId, columnKey: column.key }}
          {@const isSelectedCell = selectionState.isCellSelected(cellCoordinates)}
          {@const isAnchorCell = selectionState.isAnchorCell(cellCoordinates)}
          {@const editCellIdentity = { rowKey: rowDomId, columnKey: column.key }}
          {@const isEditingCell = editModel.isEditing(editCellIdentity)}
          {@const isSearchMatchCell =
            search && searchMatchKeys.has(getCellCoordinateKey(cellCoordinates))}
          {@const isCurrentSearchMatchCell =
            search && currentSearchMatchKey === getCellCoordinateKey(cellCoordinates)}
          <div
            id={cellId}
            class={classNames(
              'cinder-data-grid__cell',
              isSearchMatchCell && 'cinder-data-grid__cell--search-match',
              isCurrentSearchMatchCell && 'cinder-data-grid__cell--search-match-current',
            )}
            role={column.rowHeader ? 'rowheader' : 'gridcell'}
            aria-colindex={getAriaColIndex(column)}
            aria-selected={isSelectedCell ? 'true' : undefined}
            tabindex="-1"
            data-cinder-pin={column.pin}
            data-cinder-active={activeCellId === cellId ? 'true' : undefined}
            data-cinder-selected={isSelectedCell ? '' : undefined}
            data-cinder-anchor={isAnchorCell ? 'true' : undefined}
            data-cinder-editable={column.editable ? 'true' : undefined}
            data-cinder-editing={isEditingCell ? 'true' : undefined}
            data-cinder-search-match={isSearchMatchCell ? '' : undefined}
            data-cinder-search-match-current={isCurrentSearchMatchCell ? '' : undefined}
            data-cinder-row-id={rowId}
            data-cinder-row-dom-id={rowDomId}
            data-cinder-column-key={column.key}
            data-cinder-row-index={rowIndex}
            style={getCellStyle(column)}
          >
            {#if isEditingCell && !column.cell}
              {@const editType = resolveDataGridEditType(column.editType, editModel.originalValue)}
              <Input
                id={getEditingInputId(editCellIdentity)}
                type={editType}
                bind:value={editModel.draftValue}
                inputAttachment={focusEditingInput}
                class="cinder-data-grid__cell-editor-input"
                aria-label={typeof column.header === 'string' ? column.header : undefined}
                onblur={() => handleEditInputBlur(editCellIdentity)}
              />
            {:else if column.cell}
              {@render column.cell({ row, value, editing: isEditingCell })}
            {:else}
              {formatDataGridValue(value)}
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<div
  class="cinder-sr-only cinder-data-grid__live-region"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {renderedLiveRegionMessage}
</div>
