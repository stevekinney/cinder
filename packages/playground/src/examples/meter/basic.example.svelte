<script lang="ts" module>
  export const title = 'Basic meter';
  export const description = 'Bounded measurement for a fluctuating value.';
</script>

<script lang="ts">
  import { Meter } from '@lostgradient/cinder/meter';
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Meter value={32} ariaLabel="Battery level" />
  <Meter value={68} ariaLabel="Memory usage" />
</div>
