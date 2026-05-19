<script lang="ts" module>
  export const title = 'Well, edge-to-edge on mobile';
  export const description = 'A well that bleeds to the viewport edge below the mobile breakpoint.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<Card variant="well" edgeToEdgeOnMobile>
  <div class="placeholder"></div>
</Card>

<style>
  .placeholder {
    min-block-size: 8rem;
    border: 1px dashed var(--cinder-border-muted);
    border-radius: var(--cinder-radius-sm);
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 0.5rem,
      color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem,
      color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem
    );
  }
</style>
