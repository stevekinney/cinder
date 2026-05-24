<script lang="ts" module>
  export const title = 'Cascading toggle';
  export const description =
    'Branch activation can opt into selecting or clearing the branch and its explicit selection scope.';
</script>

<script lang="ts">
  import { Tree } from 'cinder/tree';

  let selectedIds = $state<string[]>([]);
  let expandedIds = $state<string[]>(['docs']);
</script>

<Tree
  aria-label="Documentation folders"
  selectionMode="multiple"
  checkboxSelection
  selectionBehavior="cascade"
  bind:selectedIds
  bind:expandedIds
>
  <Tree.Item id="docs" label="docs" branch selectionScopeIds={['docs', 'guides', 'api']}>
    <Tree.Item id="guides" label="guides" />
    <Tree.Item id="api" label="api-reference.md" />
  </Tree.Item>
  <Tree.Item id="changelog" label="CHANGELOG.md" />
</Tree>

<p style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--cinder-text-muted);">
  Toggle the docs branch checkbox to select or clear its full scope.
</p>
