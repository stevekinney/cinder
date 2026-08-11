# LineChart

Responsive SVG line chart for comparing one or more numeric series over an ordered x domain.

## Usage

```svelte
<script lang="ts">
  import LineChart from '@lostgradient/cinder/line-chart';
</script>

<LineChart label="Loading revenue" loading series={[]} />
```

## Guidance

### Use When

- Showing trends over time or another ordered domain.
- Comparing several metric series on the same numeric axis.

### Avoid When

- Comparing discrete category totals — use bar-chart instead.
- Showing cumulative filled trends — use area-chart instead.

## Rendering and customization

LineChart uses SVG, with guide margins derived from the rendered tick labels, rotation, and axis titles. Its default theme inherits `currentColor`, keeps the chart background transparent, and resolves series colors from `--cinder-chart-series-*`; pass `theme` to override only the fields you need.

Set `tooltip={true}` for the default focus-aware visual tooltip, or pass a `Snippet<[ChartTarget]>` for custom content. Pass `mark` to replace each default series mark while retaining the chart's scales, guides, focus targets, and semantic data table. Series above 2,000 points are decimated for SVG rendering. The interaction model retains the complete dataset, while the data table evenly samples at most 2,000 rows and discloses the displayed and total point counts in its caption.

## Props

<!-- generated:props:start -->

| Prop                       | Type                                                                                                                   | Required | Default | Description                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                    | `string`                                                                                                               | no       | —       | Custom class applied to the root element.                                                                                                                                   |
| `dataTableCaption`         | `string`                                                                                                               | no       | —       | Custom data table caption; falls back to `label`.                                                                                                                           |
| `dataTableVisibility`      | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                                    | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                                                                               |
| `description`              | `string`                                                                                                               | no       | —       | Optional description rendered below the label.                                                                                                                              |
| `height`                   | `number`                                                                                                               | no       | —       | Pixel height of the chart viewport. Default `280`.                                                                                                                          |
| `hiddenSeriesIds`          | `string`[]                                                                                                             | no       | —       | IDs of series currently hidden from the chart. Can be two-way bound with `bind:hiddenSeriesIds`.                                                                            |
| `label`                    | `string`                                                                                                               | yes      | —       | Accessible label for the chart. Required for screen readers.                                                                                                                |
| `legendPosition`           | `"top"` \| `"bottom"` \| `"none"`                                                                                      | no       | —       | Where to render the series legend relative to the chart. Default `top`.                                                                                                     |
| `loading`                  | `boolean`                                                                                                              | no       | —       | Whether the chart is in a loading state. Default `false`.                                                                                                                   |
| `maximumInteractivePoints` | `number`                                                                                                               | no       | —       | Maximum number of interactive focus targets before keyboard navigation is disabled. Default `500`.                                                                          |
| `series`                   | ({ color?: `string`; data: ({ x: `string` \| `number`; y?: `number` \| `null` })[]; id: `string`; label: `string` })[] | yes      | —       | Series to render as one or more connected line paths.                                                                                                                       |
| `theme`                    | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] }              | no       | —       | Partial visual theme override. Omitted fields inherit the surrounding application.                                                                                          |
| `tooltip`                  | `boolean`                                                                                                              | no       | —       | Enable the default visual tooltip. Custom snippet tooltips are available in the TypeScript API.                                                                             |
| `xAxis`                    | { label?: `string`; tickCount?: `number`; tickLabelRotation?: `number` }                                               | no       | —       | Configuration for the x-axis label and tick count.                                                                                                                          |
| `yAxis`                    | { label?: `string`; tickCount?: `number` }                                                                             | no       | —       | Configuration for the y-axis label and tick count.                                                                                                                          |
| `empty`                    | `(opaque)`                                                                                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                  |
| `loadingContent`           | `(opaque)`                                                                                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                  |
| `mark`                     | `(opaque)`                                                                                                             | no       | —       | Per-series renderer override. The chart retains scales, guides, focus, and data-table semantics. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
