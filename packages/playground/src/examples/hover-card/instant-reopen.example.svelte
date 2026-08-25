<script lang="ts" module>
  export const title = 'Instant reopen';
  export const description =
    'A zero open delay reopens the card immediately on re-entry, useful for adjacent triggers meant to feel like one continuous surface.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder';
</script>

<HoverCard openDelay={0}>
  {#snippet trigger()}
    <Button variant="ghost">CIN-99</Button>
  {/snippet}

  <strong>CIN-99</strong>
  <p>Reproduce the flaky drag handle in the tree view's reorder mode.</p>
</HoverCard>
