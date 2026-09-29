# DonutChart

`DonutChart` visualizes a small set of part-to-whole values. It exposes visible value labels, an optional center label, series activation, and a horizontal-scroll escape hatch for narrow containers.

Use a bar chart when precise comparison matters more than the part-to-whole relationship.

## Usage

```svelte
<script lang="ts">
  import { DonutChart } from '@lostgradient/cinder';

  const data = [
    { id: 'build', label: 'Build', value: 42 },
    { id: 'review', label: 'Review', value: 28 },
    { id: 'test', label: 'Test', value: 18 },
    { id: 'docs', label: 'Docs', value: 12 },
  ];
</script>

<DonutChart label="Workload" {data} centerLabel="Tasks" valueLabels />
```

`label` is required because it names both the chart and its non-visual fallback list. `valueLabels` adds a visible `<ul>` legend with value labels; `centerLabel` is supplemental and should not be the only explanation of the total. Use `scrollable` when the legend or ring cannot fit the container, and provide `onSeriesClick` only when a series is actionable—otherwise keep the chart informational. When `valueLabels` is off, a screen-reader-only `<ul>` remains the non-visual fallback for comparison and screen-reader users (not a data table).

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `centerLabel`   | `string`   | no       | —       | Supplemental label rendered at the ring's center. Should not be the only explanation of the total.                                                                                                                                                                                                                             |
| `class`         | `string`   | no       | —       | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                       |
| `label`         | `string`   | yes      | —       | Names both the chart and its non-visual fallback list.                                                                                                                                                                                                                                                                         |
| `scrollable`    | `boolean`  | no       | `false` | Enables a horizontal-scroll escape hatch for narrow containers. Defaults to `false`.                                                                                                                                                                                                                                           |
| `valueLabels`   | `boolean`  | no       | `false` | Adds a visible `<ul>` legend with value labels below the ring, in place of the screen-reader-only fallback list. Defaults to `false`.                                                                                                                                                                                          |
| `data`          | `(opaque)` | yes      | —       | Part-to-whole values rendered as the ring and, when `valueLabels` is off, as a screen-reader-only fallback `<ul>` (not a data table). A negative, `NaN`, or infinite `value` renders as `0` rather than being rejected—see `DonutChartDatum.value`. Not expressible in JSON Schema; see the component types for the signature. |
| `onSeriesClick` | `(opaque)` | no       | —       | Called when a series is activated. Provide only when the series is actionable. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
