<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /**
   * Discriminated union for row selection props.
   *
   * - Active branch: supply `selected` + `onSelectedChange` + `selectionLabel`.
   * - Opt-out branch: supply `selectionDisabled: true` — renders an empty alignment cell.
   * - Inert branch: supply nothing — only valid when `Table.selectable` is false or
   *   the row is inside `TableHeader`.
   *
   * Note: Svelte 5's `$props()` merges discriminated union branches into a flat
   * object at destructuring time. TypeScript cannot narrow the active vs inert
   * branch after destructuring. Runtime validation enforces the contract when
   * `Table.selectable` is true — both `selected` and `selectionLabel` are
   * required together and `onSelectedChange` must be present.
   */
  export type TableRowSelectionProps =
    | {
        selected: boolean;
        onSelectedChange: (next: boolean) => void;
        selectionLabel: string;
        selectionDisabled?: false;
      }
    | {
        selectionDisabled: true;
        selected?: undefined;
        onSelectedChange?: undefined;
        selectionLabel?: undefined;
      }
    | {
        selected?: undefined;
        onSelectedChange?: undefined;
        selectionLabel?: undefined;
        selectionDisabled?: undefined;
      };

  export type TableRowProps = {
    /** Additional class names merged with `.cinder-table__row`. */
    class?: string;
    /** Cell children (TableCell or TableHeaderCell). */
    children: Snippet;
  } & TableRowSelectionProps;
</script>

<script lang="ts">
  import { getContext } from 'svelte';

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
    selected,
    onSelectedChange,
    selectionLabel,
    selectionDisabled,
  }: TableRowProps = $props();

  const table = getContext<TableContext | undefined>(TABLE_CONTEXT_KEY);
  const selectionEnabled = table?.selectionEnabled ?? false;

  const section = getContext<TableSectionContext | undefined>(TABLE_SECTION_CONTEXT_KEY);
  const headerSelection = getContext<TableHeaderSelectionContext | undefined>(
    TABLE_HEADER_SELECTION_CONTEXT_KEY,
  );

  // Validate body rows when selection is enabled.
  if (selectionEnabled && section === 'body') {
    const hasDisabled = selectionDisabled === true;
    if (!hasDisabled) {
      // All three must be present — reject partial trios.
      const hasSelected = selected !== undefined;
      const hasOnChange = onSelectedChange !== undefined;
      const hasLabel = selectionLabel !== undefined;
      if (!hasSelected || !hasOnChange || !hasLabel) {
        throw new Error(
          '[Cinder] TableRow: when Table.selectable is true, each body row must supply ' +
            'selected + onSelectedChange + selectionLabel together, or set selectionDisabled={true}. ' +
            `Missing: ${[!hasSelected && 'selected', !hasOnChange && 'onSelectedChange', !hasLabel && 'selectionLabel'].filter(Boolean).join(', ')}.`,
        );
      }
    }
  }

  // Warn when a row is rendered directly under Table (no section context) with selection on.
  if (selectionEnabled && section === undefined) {
    console.warn(
      '[Cinder] TableRow: rendered outside TableHeader or TableBody while Table.selectable is true. ' +
        'The leading selection cell will not be rendered.',
    );
  }

  function handleSelectAllChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    headerSelection?.onSelectAll(input.checked);
  }

  function handleRowChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    onSelectedChange?.(input.checked);
  }

  // Sync indeterminate state on the select-all checkbox via DOM property.
  let selectAllInput: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (selectAllInput && headerSelection) {
      selectAllInput.indeterminate = headerSelection.someSelected && !headerSelection.allSelected;
    }
  });

  const shouldRenderHeaderSelectionCell =
    selectionEnabled && section === 'header' && headerSelection !== undefined;

  if (shouldRenderHeaderSelectionCell) {
    headerSelection?.claimSelectionHeaderCell();
  }
</script>

<tr class={cn('cinder-table__row', className)}>
  {#if shouldRenderHeaderSelectionCell && headerSelection}
    <th scope="col" class="cinder-table__header-cell cinder-table__header-cell--selection">
      <input
        bind:this={selectAllInput}
        type="checkbox"
        class="cinder-table__selection-checkbox"
        checked={headerSelection.allSelected}
        aria-label={headerSelection.selectAllLabel}
        onchange={handleSelectAllChange}
      />
    </th>
  {/if}
  {#if selectionEnabled && section === 'body'}
    {#if selectionDisabled}
      <td
        class="cinder-table__cell cinder-table__cell--selection cinder-table__cell--selection-disabled"
      >
        <input
          type="checkbox"
          class="cinder-table__selection-checkbox"
          disabled
          aria-label="Selection not allowed for this row"
        />
      </td>
    {:else}
      <td class="cinder-table__cell cinder-table__cell--selection">
        <input
          type="checkbox"
          class="cinder-table__selection-checkbox"
          checked={selected}
          aria-label={selectionLabel}
          onchange={handleRowChange}
        />
      </td>
    {/if}
  {/if}
  {@render children()}
</tr>
