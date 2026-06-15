# LineChart

Responsive SVG line chart for comparing one or more numeric series over an ordered x domain.

## Usage

```svelte
<script lang="ts">
  import { LineChart } from '@lostgradient/cinder/line-chart';
</script>
```

## Guidance

### Use When

- Showing trends over time or another ordered domain.
- Comparing several metric series on the same numeric axis.

### Avoid When

- Comparing discrete category totals — use bar-chart instead.
- Showing cumulative filled trends — use area-chart instead.

## Props

<!-- generated:props:start -->

| Prop                       | Type                                                                                                                   | Required | Default | Description                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                    | `string`                                                                                                               | no       | —       | Custom class applied to the root element.                                                                                  |
| `dataTableCaption`         | `string`                                                                                                               | no       | —       | Custom data table caption; falls back to `label`.                                                                          |
| `dataTableVisibility`      | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                                    | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                              |
| `description`              | `string`                                                                                                               | no       | —       | Optional description rendered below the label.                                                                             |
| `height`                   | `number`                                                                                                               | no       | —       | Pixel height of the chart viewport. Default `280`.                                                                         |
| `hiddenSeriesIds`          | `string`[]                                                                                                             | no       | —       | IDs of series currently hidden from the chart. Can be two-way bound with `bind:hiddenSeriesIds`.                           |
| `label`                    | `string`                                                                                                               | yes      | —       | Accessible label for the chart. Required for screen readers.                                                               |
| `legendPosition`           | `"top"` \| `"bottom"` \| `"none"`                                                                                      | no       | —       | Where to render the series legend relative to the chart. Default `top`.                                                    |
| `loading`                  | `boolean`                                                                                                              | no       | —       | Whether the chart is in a loading state. Default `false`.                                                                  |
| `maximumInteractivePoints` | `number`                                                                                                               | no       | —       | Maximum number of interactive focus targets before keyboard navigation is disabled. Default `500`.                         |
| `series`                   | ({ color?: `string`; data: ({ x: `string` \| `number`; y?: `number` \| `null` })[]; id: `string`; label: `string` })[] | yes      | —       | Series to render as one or more connected line paths.                                                                      |
| `xAxis`                    | { label?: `string`; tickCount?: `number` }                                                                             | no       | —       | Configuration for the x-axis label and tick count.                                                                         |
| `yAxis`                    | { label?: `string`; tickCount?: `number` }                                                                             | no       | —       | Configuration for the y-axis label and tick count.                                                                         |
| `empty`                    | `(opaque)`                                                                                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `loadingContent`           | `(opaque)`                                                                                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
