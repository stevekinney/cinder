<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TableHeaderProps = {
    /** Additional class names merged with `.cinder-table__header`. */
    class?: string;
    /** TableRow children — typically a single header row. */
    children: Snippet;
    /** Checked state for the select-all checkbox. Required when `Table.selectable` is true. */
    allSelected?: boolean;
    /**
     * When true and `allSelected` is false, the select-all checkbox renders as indeterminate.
     * The browser exposes that as `aria-checked="mixed"` to assistive tech.
     * Defaults to false. Required (alongside `allSelected` and `onSelectAll`) when
     * `Table.selectable` is true for accurate checkbox state.
     */
    someSelected?: boolean;
    /** Called when the user activates the select-all checkbox. Required when `Table.selectable` is true. */
    onSelectAll?: (next: boolean) => void;
    /**
     * Accessible name for the select-all checkbox. Defaults to "Select all rows".
     * When the table contains rows with `selectionDisabled={true}`, pass a more
     * accurate label such as "Select all selectable rows".
     */
    selectAllLabel?: string;
  };
</script>

<script lang="ts">
  import { getContext, setContext } from 'svelte';

  import {
    TABLE_CONTEXT_KEY,
    TABLE_SECTION_CONTEXT_KEY,
    TABLE_HEADER_SELECTION_CONTEXT_KEY,
    type TableContext,
    type TableSectionContext,
    type TableHeaderSelectionContext,
  } from './table.svelte';
  import { cn } from '../utilities/class-names.ts';

  let {
    class: className,
    children,
    allSelected = false,
    someSelected = false,
    onSelectAll,
    selectAllLabel = 'Select all rows',
  }: TableHeaderProps = $props();

  const table = getContext<TableContext | undefined>(TABLE_CONTEXT_KEY);
  const selectionEnabled = table?.selectionEnabled ?? false;

  if (selectionEnabled && !onSelectAll) {
    throw new Error(
      '[Cinder] TableHeader: `onSelectAll` is required when Table.selectable is true.',
    );
  }

  setContext<TableSectionContext>(TABLE_SECTION_CONTEXT_KEY, 'header');

  setContext<TableHeaderSelectionContext>(TABLE_HEADER_SELECTION_CONTEXT_KEY, {
    get allSelected() {
      return allSelected;
    },
    get someSelected() {
      return someSelected;
    },
    get onSelectAll() {
      return onSelectAll ?? (() => {});
    },
    get selectAllLabel() {
      return selectAllLabel;
    },
  });
</script>

<thead class={cn('cinder-table__header', className)}>
  {@render children()}
</thead>
