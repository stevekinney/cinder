<script lang="ts" module>
  export const title = 'Card with grey body';
  export const description = 'A card whose body uses the muted surface tone.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<Card bodyTone="muted">
  {#snippet header()}
    <div class="header-placeholder"></div>
  {/snippet}
  <div class="placeholder"></div>
</Card>

<style>
  .header-placeholder,
  .placeholder {
    inline-size: 100%;
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
