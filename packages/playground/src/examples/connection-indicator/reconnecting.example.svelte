<script lang="ts" module>
  export const title = 'Reconnecting with attempt count';
  export const description =
    'The reconnecting state showing a retry attempt via the attempt snippet.';
</script>

<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
</script>

<ConnectionIndicator status="reconnecting">
  {#snippet attempt()}
    attempt 3 of 5
  {/snippet}
</ConnectionIndicator>
