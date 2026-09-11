<script lang="ts" module>
  export const title = 'Arrow surface probe';
  export const description =
    'Deterministic, arrow-visible fixture for the CIN-606 pixel probe (packages/testing/tests/popover-arrow-surface-parity.playwright.ts), which asserts the arrow occludes rather than composites with the backdrop.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder';

  let open = $state(false);
</script>

<div style="display: flex; gap: 0.5rem; align-items: center; padding-block-start: 4rem;">
  <Button onclick={() => (open = true)}>Show arrow probe</Button>
  <Button onclick={() => (open = false)}>Hide arrow probe</Button>

  <HoverCard bind:open arrowVisible>
    {#snippet trigger()}
      <Button variant="ghost">Arrow probe</Button>
    {/snippet}

    <strong>Arrow probe</strong>
    <p>Fixed-open panel with its arrow visible for pixel sampling.</p>
  </HoverCard>
</div>
