<script lang="ts" module>
  export const title = 'Basic connection indicator';
  export const description = 'Live-status pill showing the current realtime channel state.';
</script>

<script lang="ts">
  import { ConnectionIndicator } from '@lostgradient/cinder/connection-indicator';
  import type { ConnectionState } from '@lostgradient/cinder/connection-indicator';

  const states: ConnectionState[] = ['connected', 'connecting', 'disconnected', 'error'];
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  {#each states as state}
    <ConnectionIndicator {state} />
  {/each}
</div>
