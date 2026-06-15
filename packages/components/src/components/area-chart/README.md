# AreaChart

Filled SVG area chart for showing magnitude and cumulative trends across an ordered x domain.

## Usage

```svelte
<script lang="ts">
  import { AreaChart } from '@lostgradient/cinder/area-chart';
</script>
```

## Guidance

### Use When

- Showing magnitude under a trend line.
- Comparing cumulative or stacked contribution over an ordered domain.

### Avoid When

- Exact point comparison matters more than area magnitude — use line-chart instead.
- Comparing discrete category totals — use bar-chart instead.

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
| `mode`                     | `"single"` \| `"stacked"`                                                                                              | no       | —       | Area rendering mode. Default `single`.                                                                                     |
| `series`                   | ({ color?: `string`; data: ({ x: `string` \| `number`; y?: `number` \| `null` })[]; id: `string`; label: `string` })[] | yes      | —       | Series rendered as independent filled areas or stacked areas.                                                              |
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
