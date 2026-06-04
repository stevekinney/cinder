<script lang="ts" module>
  export const title = 'Custom hover delays';
  export const description = 'Hover cards can tune open and close delay for denser interfaces.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder';
</script>

<HoverCard openDelay={100} closeDelay={300}>
  {#snippet trigger()}
    <Button variant="ghost">CIN-42</Button>
  {/snippet}

  <strong>CIN-42</strong>
  <p>Investigate overlay stacking behavior in nested surfaces.</p>
</HoverCard>
