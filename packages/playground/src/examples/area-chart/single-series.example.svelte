<script lang="ts" module>
  export const title = 'Usage area';
  export const description = 'A single-series area chart for product usage.';
</script>

<script lang="ts">
  import { AreaChart } from '@lostgradient/cinder/area-chart';

  const series = [
    {
      id: 'usage',
      label: 'Usage',
      data: [
        { x: 'Jan', y: 44 },
        { x: 'Feb', y: 61 },
        { x: 'Mar', y: 79 },
      ],
    },
  ];
</script>

<AreaChart label="Product usage" {series} />
