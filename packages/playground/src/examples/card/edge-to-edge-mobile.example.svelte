<script lang="ts" module>
  export const title = 'Card, edge-to-edge on mobile';
  export const description = 'A card that bleeds to the viewport edge below the mobile breakpoint.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
</script>

<Card edgeToEdgeOnMobile>
  <div
    style="min-block-size: 8rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
</Card>
