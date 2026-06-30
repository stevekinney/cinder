<script lang="ts" module>
  export const title = 'Vertical status strip';
  export const description = 'Loop status messages vertically and pause while focused.';
</script>

<script lang="ts">
  import { Marquee } from '@lostgradient/cinder/marquee';
</script>

<div style="max-inline-size: 24rem;">
  <Marquee direction="vertical" duration="14s" label="System status updates">
    {#snippet children()}
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <span>API latency is nominal.</span>
        <span>Background jobs running in us-east-1.</span>
        <span>Next maintenance window: Saturday 02:00 UTC.</span>
      </div>
    {/snippet}
  </Marquee>
</div>
