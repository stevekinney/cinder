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

| Prop                       | Type                                                                                                                   | Required | Default | Description |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------- |
| `class`                    | `string`                                                                                                               | no       | —       |             |
| `dataTableCaption`         | `string`                                                                                                               | no       | —       |             |
| `dataTableVisibility`      | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                                    | no       | —       |             |
| `description`              | `string`                                                                                                               | no       | —       |             |
| `height`                   | `number`                                                                                                               | no       | —       |             |
| `hiddenSeriesIds`          | `string`[]                                                                                                             | no       | —       |             |
| `label`                    | `string`                                                                                                               | yes      | —       |             |
| `legendPosition`           | `"top"` \| `"bottom"` \| `"none"`                                                                                      | no       | —       |             |
| `loading`                  | `boolean`                                                                                                              | no       | —       |             |
| `maximumInteractivePoints` | `number`                                                                                                               | no       | —       |             |
| `series`                   | ({ color?: `string`; data: ({ x: `string` \| `number`; y?: `number` \| `null` })[]; id: `string`; label: `string` })[] | yes      | —       |             |
| `xAxis`                    | { label?: `string`; tickCount?: `number` }                                                                             | no       | —       |             |
| `yAxis`                    | { label?: `string`; tickCount?: `number` }                                                                             | no       | —       |             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
