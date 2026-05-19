<script lang="ts" module>
  export const title = 'Well on grey';
  export const description = 'A well presented on a muted surrounding surface.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<div class="muted-frame">
  <Card variant="well">
    <div class="placeholder"></div>
  </Card>
</div>

<style>
  .muted-frame {
    padding: var(--cinder-space-4);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-inset);
  }

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
