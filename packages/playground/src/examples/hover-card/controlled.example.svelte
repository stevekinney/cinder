<script lang="ts" module>
  export const title = 'Controlled visibility';
  export const description =
    'The open state can be bound and driven externally, letting another control show or hide the card without waiting on hover or focus delays.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder';

  let open = $state(false);
</script>

<div style="display: flex; gap: 0.5rem; align-items: center;">
  <Button onclick={() => (open = true)}>Show</Button>
  <Button onclick={() => (open = false)}>Hide</Button>

  <HoverCard bind:open>
    {#snippet trigger()}
      <Button variant="ghost">CIN-14</Button>
    {/snippet}

    <strong>CIN-14</strong>
    <p>Track down the intermittent double-submit on the settings form.</p>
  </HoverCard>
</div>
