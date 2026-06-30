<script lang="ts" module>
  export const title = 'Segmented thresholds';
  export const description =
    'Render low, optimal, and high regions while preserving meter semantics for assistive technology.';
</script>

<script lang="ts">
  import { Meter } from '@lostgradient/cinder/meter';
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Meter
    value={82}
    low={30}
    high={70}
    optimum={50}
    ariaLabel="CPU utilization"
    ariaValueText="82 percent, above the recommended range"
  />
  <Meter
    value={48}
    low={30}
    high={70}
    optimum={50}
    ariaLabel="CPU utilization"
    ariaValueText="48 percent, in the recommended range"
  />
</div>
