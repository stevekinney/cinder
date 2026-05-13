<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Symbol key for the section context (header vs body). */
  export const TABLE_SECTION_CONTEXT_KEY = Symbol('cinder-table-section');

  /** Symbol key for the header selection context (select-all data + row registration). */
  export const TABLE_HEADER_SELECTION_CONTEXT_KEY = Symbol('cinder-table-header-selection');

  export type TableSectionContext = 'header' | 'body';

  export type TableHeaderSelectionContext = {
    readonly allSelected: boolean;
    readonly someSelected: boolean;
    readonly onSelectAll: (next: boolean) => void;
    readonly selectAllLabel: string;
    /**
     * Called by the header TableRow on mount. Returns a cleanup function.
     * TableHeader throws if more than one header row registers when selection is enabled.
     */
    registerHeaderRow: () => () => void;
  };

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
     */
    someSelected?: boolean;
    /** Called when the user activates the select-all checkbox. Required when `Table.selectable` is true. */
    onSelectAll?: (next: boolean) => void;
    /** Accessible name for the select-all checkbox. Defaults to "Select all rows". */
    selectAllLabel?: string;
  };
</script>

<script lang="ts">
  import { getContext, setContext } from 'svelte';

  import { TABLE_CONTEXT_KEY, type TableContext } from './table.svelte';
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

  if (selectionEnabled) {
    if (allSelected === undefined || allSelected === null) {
      throw new Error(
        '[Cinder] TableHeader: `allSelected` is required when Table.selectable is true.',
      );
    }
    if (!onSelectAll) {
      throw new Error(
        '[Cinder] TableHeader: `onSelectAll` is required when Table.selectable is true.',
      );
    }
  }

  // Plain (non-reactive) counter so mutations don't trigger the reactive graph.
  let headerRowCount = 0;

  function registerHeaderRow(): () => void {
    headerRowCount += 1;
    if (selectionEnabled && headerRowCount > 1) {
      throw new Error(
        '[Cinder] TableHeader: only one TableRow is supported inside TableHeader when Table.selectable is true.',
      );
    }
    return () => {
      headerRowCount -= 1;
    };
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
    registerHeaderRow,
  });
</script>

<thead class={cn('cinder-table__header', className)}>
  {@render children()}
</thead>
