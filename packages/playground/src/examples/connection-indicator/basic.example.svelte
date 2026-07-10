<script lang="ts" module>
  export const title = 'Basic connection indicator';
  export const description = 'A live connection pill with its default icon and label.';
</script>

<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<ConnectionIndicator status="live" />
