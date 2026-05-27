<script lang="ts" module>
  export const title = 'Custom hover delays';
  export const description = 'Hover cards can tune open and close delay for denser interfaces.';
</script>

<script lang="ts">
  import { HoverCard } from 'cinder';
</script>

<HoverCard openDelay={100} closeDelay={300}>
  {#snippet trigger()}
    <button type="button">CIN-42</button>
  {/snippet}

  <strong>CIN-42</strong>
  <p>Investigate overlay stacking behavior in nested surfaces.</p>
</HoverCard>
