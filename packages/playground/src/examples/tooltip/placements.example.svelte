<script lang="ts" module>
  export const title = 'Tooltip placements';
  export const description = 'Top, right, bottom, and left placement options.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Tooltip } from '@lostgradient/cinder/tooltip';
</script>

<div class="example-preview-row" style="padding: 1rem;">
  <Tooltip text="Appears above" placement="top">
    <Button variant="secondary">Top</Button>
  </Tooltip>
  <Tooltip text="Appears to the right" placement="right">
    <Button variant="secondary">Right</Button>
  </Tooltip>
  <Tooltip text="Appears below" placement="bottom">
    <Button variant="secondary">Bottom</Button>
  </Tooltip>
  <Tooltip text="Appears to the left" placement="left">
    <Button variant="secondary">Left</Button>
  </Tooltip>
</div>
