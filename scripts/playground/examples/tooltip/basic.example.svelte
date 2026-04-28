<script lang="ts" module>
  export const title = 'Basic tooltip';
  export const description = 'Hover or focus the trigger to show the tooltip text.';
</script>

<script lang="ts">
  import { Tooltip } from '../../../../src/index.ts';
</script>

<Tooltip text="This is a helpful explanation.">
  <button type="button">Hover me</button>
</Tooltip>
