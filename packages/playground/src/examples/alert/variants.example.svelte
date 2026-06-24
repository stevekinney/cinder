<script lang="ts" module>
  export const title = 'Alert variants';
  export const description = 'Info, success, warning, and danger alerts.';
</script>

<script lang="ts">
  import { Alert } from '@lostgradient/cinder/alert';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <Alert variant="info">Your account sync is in progress.</Alert>
  <Alert variant="success">Changes saved successfully.</Alert>
  <Alert variant="warning">Your trial expires in 3 days.</Alert>
  <Alert variant="danger">Failed to connect to the server.</Alert>
</div>
