<script lang="ts" module>
  export const title = 'Basic toolbar';
  export const description = 'A named action bar that turns several controls into one Tab stop.';
</script>

<script lang="ts">
  import Toolbar from '@lostgradient/cinder/toolbar';
  import { Button } from '@lostgradient/cinder/button';
</script>

<Toolbar aria-label="Document actions">
  <Toolbar.Group>
    <Button variant="secondary">Save</Button>
    <Button variant="secondary">Share</Button>
    <Button variant="secondary">Export</Button>
  </Toolbar.Group>
</Toolbar>
