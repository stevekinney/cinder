<script lang="ts" module>
  export const title = 'All connection states';
  export const description =
    'Each of the six states with its own icon and text label. Colors come from shared semantic tokens, so some states intentionally share a tone (e.g. connecting/reconnecting) — the icon and text carry the distinction, never color alone.';
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
