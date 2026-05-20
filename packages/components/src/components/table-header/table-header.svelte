<script lang="ts" module>
  export type { TableHeaderProps } from './table-header.types.ts';
</script>

<script lang="ts">
  import type { TableHeaderProps } from './table-header.types.ts';
  import { getContext, setContext } from 'svelte';

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

  if (
    selectionEnabled &&
    (allSelected === undefined || someSelected === undefined || !onSelectAll)
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
