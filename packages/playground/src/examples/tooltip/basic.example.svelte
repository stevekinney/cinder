<script lang="ts" module>
  export const title = 'Basic tooltip';
  export const description = 'Hover or focus the trigger to show the tooltip text.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Tooltip } from 'cinder/tooltip';
</script>

<Tooltip text="This is a helpful explanation.">
  <Button variant="secondary">Hover me</Button>
</Tooltip>
