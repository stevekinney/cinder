<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Header section of a table that groups column-header rows and exposes selection state to its descendants.
   * @tag table
   * @tag section
   * @useWhen Wrapping the column-header row that labels each column of a table.
   * @avoidWhen Wrapping body data rows — use table-body instead.
   * @related table, table-header-cell
   */
  export type { TableHeaderProps } from './table-header.types.ts';
</script>

<script lang="ts">
  import type { TableHeaderProps } from './table-header.types.ts';
  import { getContext, setContext, untrack } from 'svelte';

  import {
    TABLE_CONTEXT_KEY,
    TABLE_HEADER_SELECTION_CONTEXT_KEY,
    TABLE_SECTION_CONTEXT_KEY,
  } from '../table/table.context.ts';
  import type {
    TableContext,
    TableHeaderSelectionContext,
    TableSectionContext,
  } from '../table/table.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    class: className,
    children,
    allSelected,
    someSelected,
    onSelectAll,
    selectAllLabel = 'Select all rows',
  }: TableHeaderProps = $props();

  const table = getContext<TableContext | undefined>(TABLE_CONTEXT_KEY);
  const selectionEnabled = table?.selectionEnabled ?? false;

  // One-time mount-time guard; read the props untracked.
  if (
    selectionEnabled &&
    untrack(() => allSelected === undefined || someSelected === undefined || !onSelectAll)
  ) {
    throw new Error(
      '[Cinder] TableHeader: `allSelected`, `someSelected`, and `onSelectAll` are required when Table.selectable is true.',
    );
  }

  let hasSelectionHeaderCell = false;

  function claimSelectionHeaderCell(): void {
    if (hasSelectionHeaderCell) {
      throw new Error(
        '[Cinder] TableHeader: Table.selectable supports exactly one TableRow inside TableHeader.',
      );
    }
    hasSelectionHeaderCell = true;
  }

  setContext<TableSectionContext>(TABLE_SECTION_CONTEXT_KEY, 'header');

  setContext<TableHeaderSelectionContext>(TABLE_HEADER_SELECTION_CONTEXT_KEY, {
    get allSelected() {
      return allSelected ?? false;
    },
    get someSelected() {
      return someSelected ?? false;
    },
    get onSelectAll() {
      return onSelectAll ?? (() => {});
    },
    get selectAllLabel() {
      return selectAllLabel;
    },
    claimSelectionHeaderCell,
  });
</script>

<thead class={cn('cinder-table__header', className)}>
  {@render children()}
</thead>
