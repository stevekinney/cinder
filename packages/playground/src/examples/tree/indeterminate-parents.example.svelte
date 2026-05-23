<script lang="ts" module>
  export const title = 'Indeterminate parents';
  export const description =
    'Parent checkbox indicators move to mixed state when only part of their selection scope is selected.';
</script>

<script lang="ts">
  import { Tree } from 'cinder/tree';
  import { TreeItem } from 'cinder/tree-item';

  let selectedIds = $state<string[]>(['february']);
  let expandedIds = $state<string[]>(['archive']);
</script>

<Tree
  aria-label="Archived reports"
  selectionMode="multiple"
  checkboxSelection
  selectionBehavior="cascade"
  bind:selectedIds
  bind:expandedIds
>
  <TreeItem
    id="archive"
    label="archive"
    branch
    selectionScopeIds={['archive', 'january', 'february']}
  >
    <TreeItem id="january" label="january.pdf" />
    <TreeItem id="february" label="february.pdf" />
  </TreeItem>
  <TreeItem id="summary" label="summary.pdf" />
</Tree>
