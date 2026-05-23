<script lang="ts" module>
  export const title = 'Toolbar with groups';
  export const description = 'Adjacent groups draw their own separators without manual dividers.';
</script>

<script lang="ts">
  import Toolbar from 'cinder/toolbar';
  import { Button } from 'cinder/button';
  import Segment from 'cinder/segment';
  import SegmentedControl from 'cinder/segmented-control';
</script>

<Toolbar aria-label="Preview controls">
  <Toolbar.Group>
    <SegmentedControl id="scale" label="Scale" hideLabel value="100" onchange={() => {}}>
      <Segment value="75">75%</Segment>
      <Segment value="100">100%</Segment>
      <Segment value="125">125%</Segment>
    </SegmentedControl>
  </Toolbar.Group>

  <Toolbar.Group>
    <Button variant="ghost" size="sm">Fit</Button>
    <Button variant="ghost" size="sm">Grid</Button>
  </Toolbar.Group>
</Toolbar>
