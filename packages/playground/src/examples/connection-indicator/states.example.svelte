<script lang="ts" module>
  export const title = 'All connection states';
  export const description = 'Each of the six states with its own icon, text label, and color.';
</script>

<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<div class="example-preview-row">
  <ConnectionIndicator status="connecting" />
  <ConnectionIndicator status="live" />
  <ConnectionIndicator status="reconnecting" />
  <ConnectionIndicator status="polling" />
  <ConnectionIndicator status="stale" />
  <ConnectionIndicator status="closed" />
</div>
