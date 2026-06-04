<script lang="ts" module>
  export const title = 'Basic rating';
  export const description = 'Five-star rating with whole-star precision and keyboard navigation.';
  export const component = 'rating';
</script>

<script lang="ts">
  import { Rating } from '@lostgradient/cinder/rating';
  let score = $state(0);
</script>

<Rating id="basic-rating" bind:value={score} label="Rate this article" />

{#if score > 0}
  <p style="margin-top: 0.75rem; color: var(--cinder-text-muted);">You rated this {score} of 5.</p>
{/if}
