<script lang="ts">
  import Tree from '../../components/tree/tree.svelte';
  import TreeItem from '../../components/tree-item/tree-item.svelte';

  let { filterValue = 'apollo' }: { filterValue?: string } = $props();
</script>

<Tree aria-label="Project tree" {filterValue}>
  <TreeItem id="apollo" label="Apollo" />
  <TreeItem id="archive" label="Archive" />
</Tree>
