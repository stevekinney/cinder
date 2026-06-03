<script lang="ts" module>
  export const title = 'Basic hover card';
  export const description = 'A rich non-interactive preview that opens on hover or focus.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { HoverCard } from 'cinder';
</script>

<HoverCard>
  {#snippet trigger()}
    <Button variant="ghost">Ada Lovelace</Button>
  {/snippet}

  <strong>Ada Lovelace</strong>
  <p>Mathematician, writer, and early computing collaborator.</p>
</HoverCard>
