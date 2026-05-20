<script lang="ts" module>
  export type TreeAttachFixtureProps = {
    ids?: string[];
    showMiddle?: boolean;
  };
</script>

<script lang="ts">
  import Tree from '../../components/tree/tree.svelte';
  import TreeItem from '../../components/tree-item/tree-item.svelte';

  let { ids = ['a', 'b', 'c'], showMiddle = true }: TreeAttachFixtureProps = $props();
</script>

<Tree aria-label="Attach fixture tree">
  {#each ids as id, index (id)}
    {#if index === 1}
      {#if showMiddle}
        <TreeItem {id} label={id} />
      {/if}
    {:else}
      <TreeItem {id} label={id} />
    {/if}
  {/each}
</Tree>
