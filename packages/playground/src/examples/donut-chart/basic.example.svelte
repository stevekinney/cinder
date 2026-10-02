<script lang="ts" module>
  export const title = 'Basic donut chart';
  export const description = 'A compact breakdown of workload by category.';
</script>

<script lang="ts">
  import { DonutChart } from '@lostgradient/cinder/donut-chart';
  const data = [
    { id: 'build', label: 'Build', value: 42 },
    { id: 'review', label: 'Review', value: 28 },
    { id: 'test', label: 'Test', value: 18 },
    { id: 'docs', label: 'Docs', value: 12 },
  ];
</script>

<DonutChart label="Workload" {data} centerLabel="Tasks" valueLabels />
