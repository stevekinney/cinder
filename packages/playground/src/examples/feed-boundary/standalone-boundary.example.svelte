<script lang="ts" module>
  export const title = 'Standalone boundary';
  export const description =
    'FeedBoundary imported from its standalone entry: a role="separator" list item marking a discontinuity in a consumer-owned stream list. Inside a Feed, prefer the Feed.Boundary namespace form.';
</script>

<script lang="ts">
  import { FeedBoundary } from '@lostgradient/cinder/feed-boundary';
</script>

<ul
  style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--cinder-space-3); font-size: var(--cinder-text-sm);"
>
  <li>09:14:02 — Job nightly-sync started</li>
  <li>09:14:20 — 4,182 records fetched</li>
  <FeedBoundary
    label="Connection lost — retrying"
    datetime="2026-05-12T09:15:00Z"
    timestamp="09:15:00"
  />
  <li>09:15:31 — Resumed from checkpoint 4,182</li>
  <li>09:16:05 — Job completed</li>
</ul>
