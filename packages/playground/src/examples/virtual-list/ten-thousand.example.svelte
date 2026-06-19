<script lang="ts" module>
  export const title = '10,000 item virtual list';
  export const description =
    'A native scroll container rendering only the visible slice of a 10,000 item append-only event stream.';
</script>

<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  type EventRow = {
    id: string;
    timestamp: string;
    source: string;
    message: string;
  };

  const events: EventRow[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: `event-${index}`,
    timestamp: `2026-06-18T${String(index % 24).padStart(2, '0')}:${String(index % 60).padStart(
      2,
      '0',
    )}:00Z`,
    source: `worker-${index % 12}`,
    message: `Processed workflow event ${index.toLocaleString('en-US')}`,
  }));
</script>

<VirtualList
  items={events}
  itemHeight={36}
  height="360px"
  overscan={4}
  getKey={(event) => event.id}
  aria-label="Workflow events"
>
  {#snippet row(event, context)}
    <div
      style="display: grid; grid-template-columns: 11rem 7rem minmax(0, 1fr); gap: 0.75rem; align-items: center; min-block-size: 36px; padding-inline: 0.75rem; border-block-end: 1px solid var(--cinder-border); font-size: var(--cinder-text-sm);"
      data-index={context.index}
    >
      <span>{event.timestamp}</span>
      <strong>{event.source}</strong>
      <span>{event.message}</span>
    </div>
  {/snippet}
</VirtualList>
