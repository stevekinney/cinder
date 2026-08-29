<script lang="ts" module>
  export const title = 'Basic donut chart';
  export const description = 'A compact breakdown of workload by category.';
</script>

<script lang="ts">
  import { DonutChart } from '@lostgradient/cinder/donut-chart';
  const data = [
    { label: 'Build', value: 42 },
    { label: 'Review', value: 28 },
    { label: 'Test', value: 18 },
    { label: 'Docs', value: 12 },
  ];
</script>

<DonutChart label="Workload" {data} centerLabel="Tasks" valueLabels />
