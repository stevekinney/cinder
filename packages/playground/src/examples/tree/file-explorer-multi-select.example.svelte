<script lang="ts" module>
  export const title = 'File explorer multi-select';
  export const description =
    'A file-tree pattern with checkbox indicators, a root-level select-all control, and bindable selected ids.';
</script>

<script lang="ts">
  import { Tree } from 'cinder/tree';
  import { TreeItem } from 'cinder/tree-item';
  import { TreeSelectAll } from 'cinder/tree-select-all';

  let selectedIds = $state<string[]>(['src']);
  let expandedIds = $state<string[]>(['src', 'components']);
</script>

<Tree
  aria-label="Project files"
  selectionMode="multiple"
  checkboxSelection
  selectionBehavior="cascade"
  bind:selectedIds
  bind:expandedIds
>
  {#snippet selectionControls()}
    <TreeSelectAll label="Project files" includeDescendants />
  {/snippet}

  <TreeItem id="src" label="src" branch selectionScopeIds={['src', 'components', 'tree', 'button']}>
    <TreeItem
      id="components"
      label="components"
      branch
      selectionScopeIds={['components', 'tree', 'button']}
    >
      <TreeItem id="tree" label="tree.svelte" />
      <TreeItem id="button" label="button.svelte" />
    </TreeItem>
  </TreeItem>
  <TreeItem id="package" label="package.json" />
  <TreeItem id="readme" label="README.md" />
</Tree>

<p style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
  Selected: {selectedIds.length > 0 ? selectedIds.join(', ') : 'none'}
</p>
