<script lang="ts" module>
  export const title = 'File explorer multi-select';
  export const description =
    'A file-tree pattern with checkbox indicators, a root-level select-all control, and bindable selected ids.';
</script>

<script lang="ts">
  import { Tree } from 'cinder/tree';
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

  <Tree.Item
    id="src"
    label="src"
    branch
    selectionScopeIds={['src', 'components', 'tree', 'button']}
  >
    <Tree.Item
      id="components"
      label="components"
      branch
      selectionScopeIds={['components', 'tree', 'button']}
    >
      <Tree.Item id="tree" label="tree.svelte" />
      <Tree.Item id="button" label="button.svelte" />
    </Tree.Item>
  </Tree.Item>
  <Tree.Item id="package" label="package.json" />
  <Tree.Item id="readme" label="README.md" />
</Tree>

<p style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
  Selected: {selectedIds.length > 0 ? selectedIds.join(', ') : 'none'}
</p>
