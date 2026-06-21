<script lang="ts" module>
  /**
   * Test-only fixture: composes DataList (with an optional list-level density)
   * around StackedListItem rows so the density-context propagation can be
   * asserted. Rows 0 and 1 set no density (they inherit the list default);
   * row 2 sets density="comfortable" explicitly to verify per-row override.
   */
  export type DataListDensityFixtureProps = {
    density?: 'comfortable' | 'condensed';
  };
</script>

<script lang="ts">
  import StackedListItem from '../../components/stacked-list-item/stacked-list-item.svelte';
  import DataList from '../../components/data-list/data-list.svelte';

  let { density }: DataListDensityFixtureProps = $props();

  const rows = ['one', 'two', 'three'];
</script>

<!-- Spread density only when set: exactOptionalPropertyTypes forbids passing
     `undefined` to the optional `density?` prop. -->
<DataList items={rows} key={(row) => row} {...density ? { density } : {}}>
  {#snippet children(row)}
    {#if row === 'three'}
      <StackedListItem density="comfortable">
        {#snippet title()}{row}{/snippet}
      </StackedListItem>
    {:else}
      <StackedListItem>
        {#snippet title()}{row}{/snippet}
      </StackedListItem>
    {/if}
  {/snippet}
</DataList>
