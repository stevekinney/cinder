<script lang="ts" module>
  export const title = 'Card with header';
  export const description = 'A card with a separated header region above the body.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<Card>
  {#snippet header()}
    <div class="header-placeholder"></div>
  {/snippet}
  <div class="placeholder"></div>
</Card>

<style>
  .header-placeholder,
  .placeholder {
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

  .header-placeholder {
    min-block-size: 1.5rem;
  }

  .placeholder {
    min-block-size: 7rem;
  }
</style>
