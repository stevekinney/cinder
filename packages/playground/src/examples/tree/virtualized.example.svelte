<script lang="ts" module>
  export const title = 'Virtualized tree';
  export const description =
    'A data-driven tree renders a small window from a 10,000-item collection while preserving full aria-posinset and aria-setsize metadata.';
</script>

<script lang="ts">
  import { Tree, type TreeDataItem } from '@lostgradient/cinder/tree';

  const items: TreeDataItem[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: `virtual-file-${index}`,
    label: `Virtual file ${index}`,
  }));
</script>

<Tree
  aria-label="Virtualized files"
  {items}
  virtualized
  virtualizationEstimatedRowHeight={32}
  virtualizationHeight={320}
  style="border: 1px solid var(--cinder-border); border-radius: var(--cinder-radius-md);"
/>
