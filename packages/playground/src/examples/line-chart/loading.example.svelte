<script lang="ts" module>
  export const title = 'Loading state';
  export const description = 'A line chart with reserved layout while data loads.';
</script>

<script lang="ts">
  import { LineChart } from 'cinder/line-chart';
</script>

<LineChart label="Loading revenue" loading series={[]} />
