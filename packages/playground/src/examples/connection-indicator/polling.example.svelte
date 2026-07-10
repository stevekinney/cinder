<script lang="ts" module>
  export const title = 'Polling vs live';
  export const description =
    'Polling reads quieter and different from live through icon, motion, and font-weight — not color alone.';
</script>

<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<div class="example-preview-row">
  <ConnectionIndicator status="live" />
  <ConnectionIndicator status="polling" />
</div>
