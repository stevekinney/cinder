<script lang="ts" module>
  export const title = 'Card with grey body';
  export const description = 'A card whose body uses the muted surface tone.';
</script>

<script lang="ts">
  import { Card } from 'cinder/card';
</script>

<Card bodyTone="muted">
  {#snippet header()}
    <div
      style="inline-size: 100%; min-block-size: 1.5rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
    ></div>
  {/snippet}
  <div
    style="inline-size: 100%; min-block-size: 7rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
</Card>
