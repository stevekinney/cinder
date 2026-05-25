<script lang="ts" module>
  export const title = 'Stacked retention';
  export const description = 'A stacked area chart comparing retained accounts by cohort.';
</script>

<script lang="ts">
  import { AreaChart } from 'cinder/area-chart';

  const series = [
    {
      id: 'self-serve',
      label: 'Self-serve',
      data: [
        { x: 'Month 1', y: 28 },
        { x: 'Month 2', y: 34 },
        { x: 'Month 3', y: 39 },
      ],
    },
    {
      id: 'sales-led',
      label: 'Sales-led',
      data: [
        { x: 'Month 1', y: 18 },
        { x: 'Month 2', y: 24 },
        { x: 'Month 3', y: 31 },
      ],
    },
  ];
</script>

<AreaChart label="Retained accounts" {series} mode="stacked" />
