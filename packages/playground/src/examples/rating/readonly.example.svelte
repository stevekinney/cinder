<script lang="ts" module>
  export const title = 'Readonly display';
  export const description = 'Non-interactive readonly rating shown alongside a review count.';
  export const component = 'rating';
</script>

<script lang="ts">
  import { Rating } from '@lostgradient/cinder/rating';
</script>

<div style="display: flex; align-items: center; gap: 0.75rem;">
  <Rating
    id="readonly-rating"
    value={4.5}
    precision="half"
    readonly
    label="Average customer rating"
    hideLabel
  />
  <span style="color: var(--cinder-text-muted);">4.5 (1,238 reviews)</span>
</div>
