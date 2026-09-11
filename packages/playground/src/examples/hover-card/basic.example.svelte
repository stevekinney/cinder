<script lang="ts" module>
  export const title = 'Basic hover card';
  export const description = 'A rich non-interactive preview that opens on hover or focus.';
  export const featured = true;
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { HoverCard } from '@lostgradient/cinder/hover-card';
</script>

<HoverCard>
  {#snippet trigger()}
    <Button variant="ghost">Ada Lovelace</Button>
  {/snippet}

  <strong>Ada Lovelace</strong>
  <p>Mathematician, writer, and early computing collaborator.</p>
</HoverCard>
