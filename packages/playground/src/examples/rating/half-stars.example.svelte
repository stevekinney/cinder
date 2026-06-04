<script lang="ts" module>
  export const title = 'Half-star precision';
  export const description = 'Five-star rating with half-star steps for finer-grained scores.';
  export const component = 'rating';
</script>

<script lang="ts">
  import { Rating } from '@lostgradient/cinder/rating';
  let score = $state(0);
</script>

<Rating id="half-star-rating" bind:value={score} precision="half" label="Restaurant rating" />
