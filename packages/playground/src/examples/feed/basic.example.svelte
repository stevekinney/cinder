<script lang="ts" module>
  export const title = 'Basic feed';
  export const description =
    'A semantic feed of dated events. Uses the Feed namespace API: Feed.Event composes inside the parent Feed list. The event body is the default child content; the visible time label is a plain `timestamp` string.';
</script>

<script lang="ts">
  import { Feed } from '@lostgradient/cinder/feed';
</script>

<Feed aria-label="Project activity">
  <Feed.Event datetime="2025-05-12T15:30:00Z" timestamp="2m ago">
    {#snippet icon()}
      <span aria-hidden="true">★</span>
    {/snippet}
    <p style="margin: 0;">Ada Lovelace starred the repository.</p>
  </Feed.Event>
  <Feed.Event datetime="2025-05-12T14:05:00Z" timestamp="1h ago">
    {#snippet icon()}
      <span aria-hidden="true">✎</span>
    {/snippet}
    <p style="margin: 0;">Grace Hopper opened a pull request.</p>
  </Feed.Event>
  <Feed.Event variant="minimal" datetime="2025-05-11T09:42:00Z" timestamp="Yesterday">
    <p style="margin: 0;">Alan Turing commented on issue #42.</p>
  </Feed.Event>
</Feed>
