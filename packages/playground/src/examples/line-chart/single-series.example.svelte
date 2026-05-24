<script lang="ts" module>
  export const title = 'Revenue trend';
  export const description = 'A single-series line chart for monthly recurring revenue.';
</script>

<script lang="ts">
  import { LineChart } from 'cinder/line-chart';

  const series = [
    {
      id: 'revenue',
      label: 'Revenue',
      data: [
        { x: 'Jan', y: 120 },
        { x: 'Feb', y: 148 },
        { x: 'Mar', y: 172 },
        { x: 'Apr', y: 196 },
      ],
    },
  ];
</script>

<LineChart label="Monthly recurring revenue" {series} dataTableVisibility="visible" />
