<script lang="ts" module>
  export const title = 'Activation funnel';
  export const description = 'A multi-series line chart comparing signups and activations.';
</script>

<script lang="ts">
  import { LineChart } from 'cinder/line-chart';

  const series = [
    {
      id: 'signups',
      label: 'Signups',
      data: [
        { x: 'Week 1', y: 84 },
        { x: 'Week 2', y: 96 },
        { x: 'Week 3', y: 112 },
      ],
    },
    {
      id: 'activated',
      label: 'Activated',
      data: [
        { x: 'Week 1', y: 42 },
        { x: 'Week 2', y: 58 },
        { x: 'Week 3', y: 71 },
      ],
    },
  ];
</script>

<LineChart label="Activation funnel" {series} />
