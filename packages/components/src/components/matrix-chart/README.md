# MatrixChart

Categorical × categorical heatmap for dense analytics, confusion matrices, and correlation grids.

## Usage

```svelte
<script lang="ts">
  import MatrixChart from '@lostgradient/cinder/matrix-chart';

  const data = [
    { actual: 'Cat', predicted: 'Cat', count: 50 },
    { actual: 'Cat', predicted: 'Dog', count: 5 },
    { actual: 'Cat', predicted: 'Bird', count: 2 },
    { actual: 'Dog', predicted: 'Cat', count: 3 },
    { actual: 'Dog', predicted: 'Dog', count: 42 },
    { actual: 'Dog', predicted: 'Bird', count: 1 },
    { actual: 'Bird', predicted: 'Cat', count: 4 },
    { actual: 'Bird', predicted: 'Dog', count: 2 },
    { actual: 'Bird', predicted: 'Bird', count: 38 },
  ];
</script>

<MatrixChart
  label="Confusion matrix — Animal classifier"
  description="Rows are actual classes; columns are predicted classes. Diagonal cells are correct predictions."
  {data}
  xField="predicted"
  yField="actual"
  valueField="count"
  colorScale="sequential"
  dataTableVisibility="visible"
/>
```

## Guidance

### Use When

- Showing density or magnitude across two categorical dimensions simultaneously.
- Rendering a confusion matrix where rows are actual classes and columns are predicted classes.

### Avoid When

- Showing a continuous trend over time — use line-chart instead.
- Comparing discrete category totals — use bar-chart instead.

## Rendering and theming

MatrixChart uses SVG and derives its plot margins from the category labels instead of fixed offsets. The default foreground follows `currentColor`, the chart background remains transparent, and heatmap colors resolve through `--cinder-chart-series-*` against the semantic inset surface. Pass a partial `theme` to override the palette or chart colors. The semantic data table remains the exact, non-color representation of every cell.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                                                                      | Required | Default                | Description                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `cellLabelsVisible`   | `boolean`                                                                                                 | no       | `true`                 | Show cell value labels. Default `true`.                                                                                 |
| `class`               | `string`                                                                                                  | no       | —                      | Custom class applied to the root element.                                                                               |
| `colorScale`          | `"sequential"` \| `"diverging"`                                                                           | no       | `"sequential"`         | Color interpolation scale. Default `sequential`.                                                                        |
| `data`                | `object`[]                                                                                                | yes      | —                      | Rows of data. Each row must include the keys named by the `xField`, `yField`, and `valueField` props.                   |
| `dataTableCaption`    | `string`                                                                                                  | no       | —                      | Custom data table caption; falls back to `label`.                                                                       |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                       | no       | `"screen-reader-only"` | Controls data table visibility. Default `screen-reader-only`.                                                           |
| `description`         | `string`                                                                                                  | no       | —                      | Optional description rendered below the label.                                                                          |
| `height`              | `number`                                                                                                  | no       | `280`                  | Pixel height of the chart viewport. Default `280`.                                                                      |
| `label`               | `string`                                                                                                  | yes      | —                      | Accessible label for the chart. Required for screen readers.                                                            |
| `loading`             | `boolean`                                                                                                 | no       | `false`                | Whether the chart is in a loading state. Default `false`.                                                               |
| `theme`               | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] } | no       | —                      | Partial visual theme override.                                                                                          |
| `valueField`          | `string`                                                                                                  | yes      | —                      | Key on each datum used for the numeric cell value.                                                                      |
| `xField`              | `string`                                                                                                  | yes      | —                      | Key on each datum used for the x-axis (columns).                                                                        |
| `yField`              | `string`                                                                                                  | yes      | —                      | Key on each datum used for the y-axis (rows).                                                                           |
| `empty`               | `(opaque)`                                                                                                | no       | —                      | Snippet rendered when the chart has no data. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                                                                                | no       | —                      | Snippet rendered while the chart is loading. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
