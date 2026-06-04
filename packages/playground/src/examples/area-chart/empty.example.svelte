<script lang="ts" module>
  export const title = 'Empty state';
  export const description = 'An area chart with reserved layout and no available data.';
</script>

<script lang="ts">
  import { AreaChart } from '@lostgradient/cinder/area-chart';
</script>

<AreaChart label="No retention data" series={[]} dataTableVisibility="hidden" />
