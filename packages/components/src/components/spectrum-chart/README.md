# SpectrumChart

Responsive SVG frequency-bin bar chart for visualizing audio spectrum magnitude data.

## Usage

```svelte
<script lang="ts">
  import { SpectrumChart } from '@lostgradient/cinder/spectrum-chart';
</script>
```

## Guidance

### Use When

- Displaying pre-computed frequency-domain magnitude data from an FFT or spectrum analyzer.
- Showing a static frequency response or spectrum snapshot with labelled frequency bins.

### Avoid When

- Real-time live audio spectrum is needed — feed live AnalyserNode data as props yourself.
- A full time × frequency heatmap is needed — use spectrogram instead.
- General categorical bar comparison — use bar-chart instead.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                | Required | Default | Description                                                                                                         |
| --------------------- | --------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `bins`                | { label: `string`; value: `number` }[]              | yes      | —       | Frequency bins with label + magnitude value.                                                                        |
| `class`               | `string`                                            | no       | —       | Custom class applied to the root element.                                                                           |
| `dataTableCaption`    | `string`                                            | no       | —       | Custom data table caption; falls back to `label`.                                                                   |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                       |
| `description`         | `string`                                            | no       | —       | Optional description rendered below the label.                                                                      |
| `height`              | `number`                                            | no       | —       | Pixel height of the chart. Default `160`.                                                                           |
| `label`               | `string`                                            | yes      | —       | Accessible label for the chart. Required for screen readers.                                                        |
| `loading`             | `boolean`                                           | no       | —       | Whether the chart is in a loading state. Default `false`.                                                           |
| `empty`               | `(opaque)`                                          | no       | —       | Snippet rendered when there are no bins. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                          | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
