<script lang="ts" module>
  export const title = 'Status dot statuses';
  export const description = 'All six semantic status values.';
</script>

<script lang="ts">
  import { StatusDot } from 'cinder/status-dot';
</script>

<div class="example-preview-row">
  <StatusDot status="online" label="Online" />
  <StatusDot status="offline" label="Offline" />
  <StatusDot status="warning" label="Warning" />
  <StatusDot status="error" label="Error" />
  <StatusDot status="pending" label="Pending" />
  <StatusDot status="neutral" label="Neutral" />
</div>
