# DonutChart

`DonutChart` visualizes a small set of part-to-whole values. It exposes visible value labels, an optional center label, series activation, and a horizontal-scroll escape hatch for narrow containers.

Use a bar chart when precise comparison matters more than the part-to-whole relationship.

## Usage

```svelte
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
```
