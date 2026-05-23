<script lang="ts" module>
  export const title = 'Vertical toolbar';
  export const description = 'Vertical orientation swaps the roving axis to Up and Down.';
</script>

<script lang="ts">
  import Toolbar from 'cinder/toolbar';
  import { Button } from 'cinder/button';
</script>

<Toolbar aria-label="Canvas tools" orientation="vertical">
  <Toolbar.Group>
    <Button variant="secondary">Select</Button>
    <Button variant="secondary">Pen</Button>
    <Button variant="secondary">Comment</Button>
  </Toolbar.Group>
</Toolbar>
