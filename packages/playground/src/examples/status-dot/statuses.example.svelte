<script lang="ts" module>
  export const title = 'Status dot statuses';
  export const description = 'All eight semantic status values.';
</script>

<script lang="ts">
  import { StatusDot } from '@lostgradient/cinder/status-dot';
</script>

<div class="example-preview-row">
  <StatusDot status="online" label="Online" />
  <StatusDot status="offline" label="Offline" />
  <StatusDot status="warning" label="Warning" />
  <StatusDot status="danger" label="Danger" />
  <StatusDot status="pending" label="Pending" />
  <StatusDot status="neutral" label="Neutral" />
  <StatusDot status="success" label="Success" />
  <StatusDot status="accent" label="Accent" />
</div>
