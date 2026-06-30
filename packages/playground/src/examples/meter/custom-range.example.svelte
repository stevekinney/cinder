<script lang="ts" module>
  export const title = 'Custom range';
  export const description = 'Map the meter to a non-zero bounded range.';
</script>

<script lang="ts">
  import { Meter } from '@lostgradient/cinder/meter';
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Meter value={45} min={20} max={80} ariaLabel="Disk usage percent" />
  <Meter value={73} min={20} max={80} ariaLabel="Disk usage percent" />
</div>
