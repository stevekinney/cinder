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

| Prop                  | Type                                                | Required | Default | Description |
| --------------------- | --------------------------------------------------- | -------- | ------- | ----------- |
| `bins`                | { label: `string`; value: `number` }[]              | yes      | —       |             |
| `class`               | `string`                                            | no       | —       |             |
| `dataTableCaption`    | `string`                                            | no       | —       |             |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       |             |
| `description`         | `string`                                            | no       | —       |             |
| `height`              | `number`                                            | no       | —       |             |
| `label`               | `string`                                            | yes      | —       |             |
| `loading`             | `boolean`                                           | no       | —       |             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
