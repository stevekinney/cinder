# MatrixChart

Categorical × categorical heatmap for dense analytics, confusion matrices, and correlation grids.

## Usage

```svelte
<script lang="ts">
  import { MatrixChart } from '@lostgradient/cinder/matrix-chart';
</script>
```

## Guidance

### Use When

- Showing density or magnitude across two categorical dimensions simultaneously.
- Rendering a confusion matrix where rows are actual classes and columns are predicted classes.

### Avoid When

- Showing a continuous trend over time — use line-chart instead.
- Comparing discrete category totals — use bar-chart instead.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                | Required | Default | Description                                                                                                             |
| --------------------- | --------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                            | no       | —       | Custom class applied to the root element.                                                                               |
| `colorScale`          | `"sequential"` \| `"diverging"`                     | no       | —       | Color interpolation scale. Default `sequential`.                                                                        |
| `data`                | `object`[]                                          | yes      | —       | Rows of data. Each row must include the keys named by the `xField`, `yField`, and `valueField` props.                   |
| `dataTableCaption`    | `string`                                            | no       | —       | Custom data table caption; falls back to `label`.                                                                       |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                           |
| `description`         | `string`                                            | no       | —       | Optional description rendered below the label.                                                                          |
| `height`              | `number`                                            | no       | —       | Pixel height of the chart viewport. Default `280`.                                                                      |
| `label`               | `string`                                            | yes      | —       | Accessible label for the chart. Required for screen readers.                                                            |
| `loading`             | `boolean`                                           | no       | —       | Whether the chart is in a loading state. Default `false`.                                                               |
| `showCellLabels`      | `boolean`                                           | no       | —       | Show cell value labels. Default `true`.                                                                                 |
| `valueField`          | `string`                                            | yes      | —       | Key on each datum used for the numeric cell value.                                                                      |
| `xField`              | `string`                                            | yes      | —       | Key on each datum used for the x-axis (columns).                                                                        |
| `yField`              | `string`                                            | yes      | —       | Key on each datum used for the y-axis (rows).                                                                           |
| `empty`               | `(opaque)`                                          | no       | —       | Snippet rendered when the chart has no data. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                          | no       | —       | Snippet rendered while the chart is loading. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
