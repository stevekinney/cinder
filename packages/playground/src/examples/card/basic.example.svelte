<script lang="ts" module>
  export const title = 'Basic card';
  export const description = 'A plain bordered card with a single body region.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
</script>

<Card>
  <div
    style="min-block-size: 8rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
</Card>
