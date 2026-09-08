<script lang="ts" module>
  export const title = 'Window scrolling';
  export const description =
    'With windowScroll the list has no scroll container of its own: it is a plain block in the page, the document is the scroller, and height is ignored. Use it when the list is the page — a feed or a results view — so the browser scrollbar and scroll restoration behave normally.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type Entry = {
    id: string;
    label: string;
  };

  // Deliberately modest: this list adds its full height to the documentation page,
  // because that page is now the thing being scrolled.
  const entries: Entry[] = Array.from({ length: 60 }, (_, index) => ({
    id: `entry-${index}`,
    label: `Entry ${index}`,
  }));
</script>

<VirtualList
  items={entries}
  itemHeight={40}
  windowScroll
  overscan={4}
  getKey={(entry) => entry.id}
  aria-label="Window-scrolled feed"
>
  {#snippet row(entry, context)}
    <div
      style="display: flex; align-items: center; gap: 0.75rem; block-size: 40px; padding-inline: 0.75rem; border-block-end: 1px solid var(--cinder-border);"
      data-index={context.index}
    >
      <span>{entry.label}</span>
    </div>
  {/snippet}
</VirtualList>
