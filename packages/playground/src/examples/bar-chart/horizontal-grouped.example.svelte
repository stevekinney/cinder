<script lang="ts" module>
  export const title = 'Horizontal incidents';
  export const description = 'A horizontal grouped bar chart for incident counts by severity.';
</script>

<script lang="ts">
  import { BarChart } from '@lostgradient/cinder/bar-chart';

  const data = [
    { severity: 'Critical escalation', current: 8, previous: 10 },
    { severity: 'High', current: 18, previous: 22 },
    { severity: 'Medium', current: 41, previous: 39 },
  ];
  const series = [
    { id: 'current', label: 'Current', valueKey: 'current' },
    { id: 'previous', label: 'Previous', valueKey: 'previous' },
  ];
</script>

<BarChart
  label="Incidents by severity"
  {data}
  categoryKey="severity"
  {series}
  orientation="horizontal"
/>
