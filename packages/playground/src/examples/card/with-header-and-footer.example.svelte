<script lang="ts" module>
  export const title = 'Card with header and footer';
  export const description = 'A card with separated header, body, and footer regions.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
</script>

<Card>
  {#snippet header()}
    <div
      style="inline-size: 100%; min-block-size: 1.5rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
    ></div>
  {/snippet}
  <div
    style="inline-size: 100%; min-block-size: 7rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
  {#snippet footer()}
    <div
      style="inline-size: 100%; min-block-size: 1.5rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
    ></div>
  {/snippet}
</Card>
