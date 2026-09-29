<script lang="ts" module>
  import type { ChoiceGridItemState } from '../../components/choice-grid/choice-grid.types.ts';

  export type ChoiceGridFixtureItem = {
    value: string;
    label: string;
    disabled?: boolean;
    state?: ChoiceGridItemState;
  };
</script>

<script lang="ts">
  import type { ChoiceGridSize } from '../../components/choice-grid/choice-grid.types.ts';
  import ChoiceGrid from '../../components/choice-grid/choice-grid.svelte';
  import ChoiceGridItem from '../../components/choice-grid-item/choice-grid-item.svelte';

  let {
    value = $bindable(null),
    values = $bindable([]),
    multiple = false,
    disabled = false,
    ariaLabel = 'Choose an option',
    items = [],
    columns = 'responsive',
    size,
    minColumnWidth,
  }: {
    value?: string | null;
    values?: string[];
    multiple?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    items?: ChoiceGridFixtureItem[];
    columns?: 'responsive' | 1 | 2 | 3 | 4;
    size?: ChoiceGridSize;
    minColumnWidth?: string;
  } = $props();

  // `exactOptionalPropertyTypes` rejects passing `size={undefined}` /
  // `minColumnWidth={undefined}` outright — spreading an empty object omits
  // the key entirely instead, so ChoiceGrid's own defaults still apply.
  const sizeProp = $derived(size === undefined ? {} : { size });
  const minColumnWidthProp = $derived(minColumnWidth === undefined ? {} : { minColumnWidth });
</script>

<ChoiceGrid
  {multiple}
  {disabled}
  {ariaLabel}
  {columns}
  {...sizeProp}
  {...minColumnWidthProp}
  bind:value
  bind:values
>
  {#each items as item (item.value)}
    <ChoiceGridItem
      value={item.value}
      disabled={item.disabled ?? false}
      state={item.state ?? 'neutral'}
    >
      {item.label}
    </ChoiceGridItem>
  {/each}
</ChoiceGrid>
