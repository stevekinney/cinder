<script lang="ts" module>
  export const title = 'Basic sparkbars';
  export const description = 'Compact bounded meters for inline spend and usage rows.';
</script>

<script lang="ts">
  import { Sparkbar } from '@lostgradient/cinder/sparkbar';
</script>

<div style="display: grid; gap: 0.75rem; max-width: 28rem;">
  <Sparkbar value={0.31} label="Draft weekly changelog" trailing="$0.31" />
  <Sparkbar value={0.64} label="Summarize review comments" trailing="$0.64" variant="success" />
  <Sparkbar value={0.88} label="Refresh screenshot gallery" trailing="$0.88" variant="warning" />
</div>
