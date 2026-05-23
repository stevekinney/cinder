<script lang="ts" module>
  export const title = 'Toolbar with spacer';
  export const description = 'Toolbar.Spacer pushes utility actions to the far edge.';
</script>

<script lang="ts">
  import Toolbar from 'cinder/toolbar';
  import { Button } from 'cinder/button';
</script>

<Toolbar aria-label="Editor actions">
  <Toolbar.Group>
    <Button variant="secondary">Bold</Button>
    <Button variant="secondary">Italic</Button>
    <Button variant="secondary">Link</Button>
  </Toolbar.Group>

  <Toolbar.Spacer />

  <Toolbar.Group>
    <Button variant="ghost" size="sm">Preview</Button>
    <Button size="sm">Publish</Button>
  </Toolbar.Group>
</Toolbar>
