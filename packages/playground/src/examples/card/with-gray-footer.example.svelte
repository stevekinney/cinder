<script lang="ts" module>
  export const title = 'Card with grey footer';
  export const description = 'A card whose footer uses the muted surface tone.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
</script>

<Card footerTone="muted">
  <div
    style="inline-size: 100%; min-block-size: 7rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
  {#snippet footer()}
    <div
      style="inline-size: 100%; min-block-size: 1.5rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
    ></div>
  {/snippet}
</Card>
