# DonutChart

`DonutChart` visualizes a small set of part-to-whole values. It exposes visible value labels, an optional center label, series activation, and a horizontal-scroll escape hatch for narrow containers.

Use a bar chart when precise comparison matters more than the part-to-whole relationship.

```svelte
<DonutChart
  label="Requests by status"
  data={statuses}
  valueLabels
  onSeriesClick={(datum) => selectStatus(datum)}
/>
```
