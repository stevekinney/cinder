<script lang="ts" module>
  export const title = 'Sticky section headers';
  export const description =
    'stickyItems names the indexes that pin to the leading edge while the reader scrolls past them. A sticky row stays mounted after its own index leaves the rendered window, which is the part plain virtualization would otherwise break: the heading would vanish exactly when it is meant to be pinned.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Row = {
    id: string;
    label: string;
    isHeader: boolean;
  };

  const sectionSize = 25;

  const rows: Row[] = Array.from({ length: 500 }, (_, index) => {
    const isHeader = index % sectionSize === 0;
    return {
      id: `row-${index}`,
      label: isHeader ? `Section ${Math.floor(index / sectionSize)}` : `Item ${index}`,
      isHeader,
    };
  });

  const stickyItems = rows.flatMap((row, index) => (row.isHeader ? [index] : []));
</script>

<VirtualList
  items={rows}
  itemHeight={36}
  height="360px"
  {stickyItems}
  getKey={(row) => row.id}
  aria-label="Grouped list with sticky headers"
>
  {#snippet row(item, context)}
    <div
      style={item.isHeader
        ? 'display: flex; align-items: center; block-size: 36px; padding-inline: 0.75rem; background: var(--cinder-surface-raised); font-weight: 600; border-block-end: 1px solid var(--cinder-border);'
        : 'display: flex; align-items: center; block-size: 36px; padding-inline: 1.5rem; border-block-end: 1px solid var(--cinder-border);'}
      data-index={context.index}
    >
      <span>{item.label}</span>
    </div>
  {/snippet}
</VirtualList>
