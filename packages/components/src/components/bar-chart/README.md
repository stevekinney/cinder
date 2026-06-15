# BarChart

Responsive SVG bar chart for grouped or stacked category comparisons.

## Usage

```svelte
<script lang="ts">
  import { BarChart } from '@lostgradient/cinder/bar-chart';
</script>
```

## Guidance

### Use When

- Comparing discrete category totals or grouped category breakdowns.
- Showing stacked contribution across known categories.

### Avoid When

- Showing a continuous ordered trend — use line-chart instead.
- Showing magnitude under a trend — use area-chart instead.

## Props

<!-- generated:props:start -->

| Prop                       | Type                                                                      | Required | Default | Description                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categoryKey`              | `string`                                                                  | yes      | —       | Category field name. Runtime validation requires every row to contain a string, number, or Date category.                                                         |
| `class`                    | `string`                                                                  | no       | —       | Custom class applied to the root element.                                                                                                                         |
| `data`                     | `object`[]                                                                | yes      | —       | JSON-safe data rows. Schema cannot express dynamic categoryKey/valueKey relationships; runtime validation narrows value-key fields to number, null, or undefined. |
| `dataTableCaption`         | `string`                                                                  | no       | —       | Custom data table caption; falls back to `label`.                                                                                                                 |
| `dataTableVisibility`      | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                       | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                                                                     |
| `description`              | `string`                                                                  | no       | —       | Optional description rendered below the label.                                                                                                                    |
| `height`                   | `number`                                                                  | no       | —       | Pixel height of the chart viewport. Default `280`.                                                                                                                |
| `hiddenSeriesIds`          | `string`[]                                                                | no       | —       | IDs of series currently hidden from the chart. Can be two-way bound with `bind:hiddenSeriesIds`.                                                                  |
| `label`                    | `string`                                                                  | yes      | —       | Accessible label for the chart. Required for screen readers.                                                                                                      |
| `legendPosition`           | `"top"` \| `"bottom"` \| `"none"`                                         | no       | —       | Where to render the series legend relative to the chart. Default `top`.                                                                                           |
| `loading`                  | `boolean`                                                                 | no       | —       | Whether the chart is in a loading state. Default `false`.                                                                                                         |
| `maximumInteractivePoints` | `number`                                                                  | no       | —       | Maximum number of interactive focus targets before keyboard navigation is disabled. Default `500`.                                                                |
| `mode`                     | `"grouped"` \| `"stacked"`                                                | no       | —       | Grouped or stacked bar layout. Default `grouped`.                                                                                                                 |
| `orientation`              | `"vertical"` \| `"horizontal"`                                            | no       | —       | Bar orientation. Default `vertical`.                                                                                                                              |
| `series`                   | { color?: `string`; id: `string`; label: `string`; valueKey: `string` }[] | yes      | —       | Series value keys. Schema cannot prove every valueKey exists on every row; runtime validation enforces it.                                                        |
| `xAxis`                    | { label?: `string`; tickCount?: `number` }                                | no       | —       | Configuration for the x-axis label and tick count.                                                                                                                |
| `yAxis`                    | { label?: `string`; tickCount?: `number` }                                | no       | —       | Configuration for the y-axis label and tick count.                                                                                                                |
| `empty`                    | `(opaque)`                                                                | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                        |
| `loadingContent`           | `(opaque)`                                                                | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                        |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
