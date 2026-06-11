# Spectrogram

Responsive SVG time × frequency heatmap for visualizing audio spectrogram data.

## Usage

```svelte
<script lang="ts">
  import { Spectrogram } from '@lostgradient/cinder/spectrogram';
</script>
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

| Prop                  | Type                                                | Required | Default | Description                                                                                                           |
| --------------------- | --------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                            | no       | —       |                                                                                                                       |
| `dataTableCaption`    | `string`                                            | no       | —       |                                                                                                                       |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       |                                                                                                                       |
| `description`         | `string`                                            | no       | —       |                                                                                                                       |
| `frames`              | { bins: `number`[]; label: `string` }[]             | yes      | —       |                                                                                                                       |
| `frequencyLabels`     | `string`[]                                          | no       | —       |                                                                                                                       |
| `height`              | `number`                                            | no       | —       |                                                                                                                       |
| `label`               | `string`                                            | yes      | —       |                                                                                                                       |
| `loading`             | `boolean`                                           | no       | —       |                                                                                                                       |
| `empty`               | `(opaque)`                                          | no       | —       | Snippet rendered when there are no frames. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                          | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
