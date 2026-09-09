<script lang="ts" module>
  export const title = 'Bi-directional infinite scroll';
  export const description =
    'onEndReached and onStartReached fire as the reader comes within overscan items of either edge. Each fires once per approach and re-arms when the item count changes, so a source that returns nothing does not spin.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Row = {
    id: number;
    label: string;
  };

  const pageSize = 50;

  let firstId = $state(0);
  let lastId = $state(100);
  let endLoads = $state(0);
  let startLoads = $state(0);

  let rows = $state<Row[]>(
    Array.from({ length: 100 }, (_, index) => ({
      id: index,
      label: `Row ${index}`,
    })),
  );

  function loadNewer() {
    endLoads += 1;
    const appended = Array.from({ length: pageSize }, (_, offset) => {
      const id = lastId + offset;
      return { id, label: `Row ${id}` };
    });
    lastId += pageSize;
    rows = [...rows, ...appended];
  }

  function loadOlder() {
    startLoads += 1;
    const prepended = Array.from({ length: pageSize }, (_, offset) => {
      const id = firstId - pageSize + offset;
      return { id, label: `Row ${id}` };
    });
    firstId -= pageSize;
    rows = [...prepended, ...rows];
  }
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <p style="color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);">
    {rows.length} rows loaded · {startLoads} older pages · {endLoads} newer pages
  </p>

  <VirtualList
    items={rows}
    itemHeight={40}
    height="320px"
    overscan={5}
    onEndReached={loadNewer}
    onStartReached={loadOlder}
    getKey={(item) => item.id}
    aria-label="Infinitely scrolling feed"
  >
    {#snippet row(item, context)}
      <div
        style="display: flex; align-items: center; gap: 0.75rem; block-size: 40px; padding-inline: 0.75rem; border-block-end: 1px solid var(--cinder-border);"
        data-index={context.index}
      >
        <span>{item.label}</span>
      </div>
    {/snippet}
  </VirtualList>
</div>
