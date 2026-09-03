<script lang="ts" module>
  export const title = 'Horizontal virtual list';
  export const description =
    "A native horizontally-scrolling container windowing 4,000 columns. When horizontal is set, itemHeight becomes each column's width in pixels and height becomes the container's inline-size instead of its block-size.";
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Column = {
    id: string;
    label: string;
  };

  const columnWidth = 160;

  const columns: Column[] = Array.from({ length: 4_000 }, (_, index) => ({
    id: `column-${index}`,
    label: `Column ${index.toLocaleString('en-US')}`,
  }));
</script>

<VirtualList
  items={columns}
  itemHeight={columnWidth}
  horizontal
  height="480px"
  overscan={4}
  getKey={(column) => column.id}
  aria-label="Horizontally scrolling columns"
>
  {#snippet row(column, context)}
    <div
      style={`display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; inline-size: ${columnWidth}px; block-size: 12rem; border-inline-end: 1px solid var(--cinder-border); font-size: var(--cinder-text-sm);`}
      data-index={context.index}
    >
      <strong>{column.label}</strong>
      <span style="color: var(--cinder-text-muted);">index {context.index}</span>
    </div>
  {/snippet}
</VirtualList>
