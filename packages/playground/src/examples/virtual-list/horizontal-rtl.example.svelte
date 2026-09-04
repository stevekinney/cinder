<script lang="ts" module>
  export const title = 'Horizontal virtual list (RTL)';
  export const description =
    'The same horizontal windowing as the horizontal example, wrapped in a dir="rtl" ancestor with Arabic row content. The component resolves a right-to-left writing direction from that ancestor and reads its scroll offset from the right edge of the container instead of the left.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Column = {
    id: string;
    label: string;
  };

  const columnWidth = 160;

  const columns: Column[] = Array.from({ length: 3_000 }, (_, index) => ({
    id: `column-${index}`,
    label: `عمود رقم ${index.toLocaleString('ar-EG')}`,
  }));
</script>

<div dir="rtl">
  <VirtualList
    items={columns}
    itemHeight={columnWidth}
    horizontal
    height="480px"
    overscan={4}
    getKey={(column) => column.id}
    aria-label="أعمدة قابلة للتمرير أفقيًا"
  >
    {#snippet row(column, context)}
      <div
        style={`display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem; inline-size: ${columnWidth}px; block-size: 12rem; border-inline-end: 1px solid var(--cinder-border); font-size: var(--cinder-text-sm);`}
        data-index={context.index}
      >
        <strong>{column.label}</strong>
        <span style="color: var(--cinder-text-muted);">الفهرس {context.index}</span>
      </div>
    {/snippet}
  </VirtualList>
</div>
