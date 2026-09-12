<script lang="ts" module>
  export const title = 'Arrow indicator';
  export const description =
    'Opens with its pointer arrow visible, pointing back at the trigger that opened it.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder/hover-card';

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
