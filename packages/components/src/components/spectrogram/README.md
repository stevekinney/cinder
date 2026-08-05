# Spectrogram

Responsive SVG time × frequency heatmap for visualizing audio spectrogram data.

## Usage

```svelte
<script lang="ts">
  import Spectrogram from '@lostgradient/cinder/spectrogram';
</script>

<Spectrogram label="Voice spectrogram" frames={[]} height={220}>
  {#snippet empty()}
    No audio analyzed yet.
  {/snippet}
</Spectrogram>
```

## Guidance

### Use When

- Visualizing how frequency content of a signal changes over time (time × frequency heatmap).
- Displaying pre-computed spectrogram frames from an FFT or short-time Fourier transform.

### Avoid When

- Only a single spectrum snapshot is needed — use spectrum-chart instead.
- Real-time live audio spectrogram is needed — feed frames as props yourself.
- A categorical × categorical heatmap without a time axis is needed — use matrix-chart instead.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                | Required | Default | Description                                                                                                            |
| --------------------- | --------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                            | no       | —       | Custom class applied to the root element.                                                                              |
| `dataTableCaption`    | `string`                                            | no       | —       | Custom data table caption; falls back to `label`.                                                                      |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                          |
| `description`         | `string`                                            | no       | —       | Optional description rendered below the label.                                                                         |
| `frames`              | { bins: `number`[]; label: `string` }[]             | yes      | —       | Ordered sequence of time-indexed frames. Each frame contains a label and an array of per-frequency-bin magnitudes.     |
| `frequencyLabels`     | `string`[]                                          | no       | —       | Optional frequency-bin labels for the y-axis (e.g. ['100 Hz', '200 Hz', …]). When omitted, bins are labelled by index. |
| `height`              | `number`                                            | no       | —       | Pixel height of the chart. Default `200`.                                                                              |
| `label`               | `string`                                            | yes      | —       | Accessible label for the chart. Required for screen readers.                                                           |
| `loading`             | `boolean`                                           | no       | —       | Whether the chart is in a loading state. Default `false`.                                                              |
| `empty`               | `(opaque)`                                          | no       | —       | Snippet rendered when there are no frames. Not expressible in JSON Schema; see the component types for the signature.  |
| `loadingContent`      | `(opaque)`                                          | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
