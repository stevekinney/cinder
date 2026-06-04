<script lang="ts" module>
  export const title = 'Status dot label and size';
  export const description = 'Visible label toggle and sm vs md sizes.';
</script>

<script lang="ts">
  import { StatusDot } from '@lostgradient/cinder/status-dot';
</script>

<div class="example-preview-column">
  <div class="example-preview-row">
    <StatusDot status="online" label="Online" showLabel={true} />
    <StatusDot status="offline" label="Offline" showLabel={true} />
    <StatusDot status="pending" label="Pending" showLabel={true} />
  </div>
  <div class="example-preview-row" style="align-items: center;">
    <StatusDot status="online" label="Small" size="sm" showLabel={true} />
    <StatusDot status="online" label="Medium" size="md" showLabel={true} />
  </div>
</div>
