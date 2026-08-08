<script lang="ts" module>
  export const title = 'Reconnect boundary';
  export const description =
    'Feed.Boundary marks stream discontinuities — reconnects and sequence gaps — between entries. The consumer owns the wording; the boundary owns the separator semantics.';
</script>

<script lang="ts">
  import { Feed } from '@lostgradient/cinder/feed';
</script>

<Feed kind="log" label="Webhook trace" connectionState="connected">
  <Feed.Event variant="minimal" datetime="2026-05-12T14:30:00Z" timestamp="14:30:00" tone="info">
    Webhook received: order.created
  </Feed.Event>
  <Feed.Event variant="minimal" datetime="2026-05-12T14:30:04Z" timestamp="14:30:04" tone="success">
    Webhook processed: order.created
  </Feed.Event>
  <Feed.Boundary
    label="Reconnected — 3 events replayed"
    datetime="2026-05-12T14:32:10Z"
    timestamp="14:32:10"
  />
  <Feed.Event variant="minimal" datetime="2026-05-12T14:32:11Z" timestamp="14:32:11" tone="info">
    Webhook received: order.paid
  </Feed.Event>
  <Feed.Boundary label="Sequence gap — expected 12, received 15" />
  <Feed.Event variant="minimal" datetime="2026-05-12T14:33:02Z" timestamp="14:33:02" tone="error">
    Webhook handler failed: order.shipped — downstream timeout
  </Feed.Event>
</Feed>
