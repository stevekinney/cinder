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
  }: {
    value?: string | null;
    values?: string[];
    multiple?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    items?: ChoiceGridFixtureItem[];
    columns?: 'responsive' | 1 | 2 | 3 | 4;
  } = $props();
</script>

<ChoiceGrid {multiple} {disabled} {ariaLabel} {columns} bind:value bind:values>
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
