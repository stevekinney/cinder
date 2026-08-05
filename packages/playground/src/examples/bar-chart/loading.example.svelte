<script lang="ts" module>
  export const title = 'Loading state';
  export const description = 'A bar chart with reserved layout while data loads.';
</script>

<script lang="ts">
  import { BarChart } from '@lostgradient/cinder/bar-chart';
</script>

<BarChart label="Loading active users" loading data={[]} categoryKey="category" series={[]} />
