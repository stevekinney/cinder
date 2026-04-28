<script lang="ts" module>
  export const title = 'Tooltip placements';
  export const description = 'Top, right, bottom, and left placement options.';
</script>

<script lang="ts">
  import { Tooltip } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; gap: 1.5rem; flex-wrap: wrap; padding: 1rem;">
  <Tooltip text="Appears above" placement="top">
    <button type="button">Top</button>
  </Tooltip>
  <Tooltip text="Appears to the right" placement="right">
    <button type="button">Right</button>
  </Tooltip>
  <Tooltip text="Appears below" placement="bottom">
    <button type="button">Bottom</button>
  </Tooltip>
  <Tooltip text="Appears to the left" placement="left">
    <button type="button">Left</button>
  </Tooltip>
</div>
