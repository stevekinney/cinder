<script lang="ts" module>
  export const title = 'Stacked ticket volume';
  export const description =
    'A vertical stacked bar chart showing open and resolved support tickets.';
</script>

<script lang="ts">
  import { BarChart } from '@lostgradient/cinder/bar-chart';

  const data = [
    { week: 'Week 1', open: 34, resolved: 70 },
    { week: 'Week 2', open: 29, resolved: 84 },
    { week: 'Week 3', open: 41, resolved: 78 },
  ];
  const series = [
    { id: 'open', label: 'Open', valueKey: 'open' },
    { id: 'resolved', label: 'Resolved', valueKey: 'resolved' },
  ];
</script>

<BarChart label="Support ticket volume" {data} categoryKey="week" {series} mode="stacked" />
