<script lang="ts" module>
  export const title = 'Instant close';
  export const description =
    'A zero close delay hides the card the instant the pointer leaves, useful for driving deterministic close-path tests without a debounce to race.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder';
</script>

<HoverCard closeDelay={0}>
  {#snippet trigger()}
    <Button variant="ghost">CIN-7</Button>
  {/snippet}

  <strong>CIN-7</strong>
  <p>Confirm the export job finishes before closing this tab.</p>
</HoverCard>
