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
| `mode`                     | `"single"` \| `"stacked"`                                                                                              | no       | —       |             |
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
