<script lang="ts" module>
  export const title = 'Grouped plan usage';
  export const description = 'A vertical grouped bar chart comparing usage by plan.';
</script>

<script lang="ts">
  import { BarChart } from '@lostgradient/cinder/bar-chart';

  const data = [
    { plan: 'Starter', active: 120, invited: 42 },
    { plan: 'Team', active: 210, invited: 76 },
    { plan: 'Enterprise', active: 92, invited: 28 },
  ];
  const series = [
    { id: 'active', label: 'Active users', valueKey: 'active' },
    { id: 'invited', label: 'Invited users', valueKey: 'invited' },
  ];
</script>

<BarChart label="Plan usage" {data} categoryKey="plan" {series} dataTableVisibility="visible" />
