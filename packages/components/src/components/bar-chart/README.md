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
| `class`                    | `string`                                                                  | no       | —       |                                                                                                                                                                   |
| `data`                     | `object`[]                                                                | yes      | —       | JSON-safe data rows. Schema cannot express dynamic categoryKey/valueKey relationships; runtime validation narrows value-key fields to number, null, or undefined. |
| `dataTableCaption`         | `string`                                                                  | no       | —       |                                                                                                                                                                   |
| `dataTableVisibility`      | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                       | no       | —       |                                                                                                                                                                   |
| `description`              | `string`                                                                  | no       | —       |                                                                                                                                                                   |
| `height`                   | `number`                                                                  | no       | —       |                                                                                                                                                                   |
| `hiddenSeriesIds`          | `string`[]                                                                | no       | —       |                                                                                                                                                                   |
| `label`                    | `string`                                                                  | yes      | —       |                                                                                                                                                                   |
| `legendPosition`           | `"top"` \| `"bottom"` \| `"none"`                                         | no       | —       |                                                                                                                                                                   |
| `loading`                  | `boolean`                                                                 | no       | —       |                                                                                                                                                                   |
| `maximumInteractivePoints` | `number`                                                                  | no       | —       |                                                                                                                                                                   |
| `mode`                     | `"grouped"` \| `"stacked"`                                                | no       | —       |                                                                                                                                                                   |
| `orientation`              | `"vertical"` \| `"horizontal"`                                            | no       | —       |                                                                                                                                                                   |
| `series`                   | { color?: `string`; id: `string`; label: `string`; valueKey: `string` }[] | yes      | —       | Series value keys. Schema cannot prove every valueKey exists on every row; runtime validation enforces it.                                                        |
| `xAxis`                    | { label?: `string`; tickCount?: `number` }                                | no       | —       |                                                                                                                                                                   |
| `yAxis`                    | { label?: `string`; tickCount?: `number` }                                | no       | —       |                                                                                                                                                                   |
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
