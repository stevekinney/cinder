<script lang="ts" module>
  export const title = 'Basic feed';
  export const description =
    'A semantic feed of dated events. Uses the Feed namespace API: Feed.Event composes inside the parent Feed list.';
</script>

<script lang="ts">
  import { Feed } from 'cinder/feed';
</script>

<Feed aria-label="Project activity">
  <Feed.Event datetime="2025-05-12T15:30:00Z">
    {#snippet icon()}
      <span aria-hidden="true">★</span>
    {/snippet}
    {#snippet timestamp()}2m ago{/snippet}
    {#snippet content()}
      <p style="margin: 0;">Ada Lovelace starred the repository.</p>
    {/snippet}
  </Feed.Event>
  <Feed.Event datetime="2025-05-12T14:05:00Z">
    {#snippet icon()}
      <span aria-hidden="true">✎</span>
    {/snippet}
    {#snippet timestamp()}1h ago{/snippet}
    {#snippet content()}
      <p style="margin: 0;">Grace Hopper opened a pull request.</p>
    {/snippet}
  </Feed.Event>
  <Feed.Event variant="minimal" datetime="2025-05-11T09:42:00Z">
    {#snippet timestamp()}Yesterday{/snippet}
    {#snippet content()}
      <p style="margin: 0;">Alan Turing commented on issue #42.</p>
    {/snippet}
  </Feed.Event>
</Feed>
