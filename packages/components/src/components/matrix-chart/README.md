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
| `class`               | `string`                                            | no       | —       |                                                                                                                         |
| `colorScale`          | `"sequential"` \| `"diverging"`                     | no       | —       |                                                                                                                         |
| `data`                | `object`[]                                          | yes      | —       |                                                                                                                         |
| `dataTableCaption`    | `string`                                            | no       | —       |                                                                                                                         |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       |                                                                                                                         |
| `description`         | `string`                                            | no       | —       |                                                                                                                         |
| `height`              | `number`                                            | no       | —       |                                                                                                                         |
| `label`               | `string`                                            | yes      | —       |                                                                                                                         |
| `loading`             | `boolean`                                           | no       | —       |                                                                                                                         |
| `showCellLabels`      | `boolean`                                           | no       | —       |                                                                                                                         |
| `valueField`          | `string`                                            | yes      | —       |                                                                                                                         |
| `xField`              | `string`                                            | yes      | —       |                                                                                                                         |
| `yField`              | `string`                                            | yes      | —       |                                                                                                                         |
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
