<script lang="ts" module>
  export const title = 'Card with header and footer';
  export const description = 'A card with separated header, body, and footer regions.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<Card>
  {#snippet header()}
    <div class="header-placeholder"></div>
  {/snippet}
  <div class="placeholder"></div>
  {#snippet footer()}
    <div class="footer-placeholder"></div>
  {/snippet}
</Card>

<style>
  .header-placeholder,
  .footer-placeholder,
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

  .header-placeholder,
  .footer-placeholder {
    min-block-size: 1.5rem;
  }

  .placeholder {
    min-block-size: 7rem;
  }
</style>
