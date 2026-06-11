# Waveform

Responsive SVG rendering of time-domain audio amplitude data as a waveform path or bar display.

## Usage

```svelte
<script lang="ts">
  import { Waveform } from '@lostgradient/cinder/waveform';
</script>
```

## Guidance

### Use When

- Visualizing pre-recorded or pre-processed audio amplitude samples in a static display.
- Showing an audio waveform thumbnail or preview with mocked or pre-computed sample data.

### Avoid When

- Real-time live audio capture is needed — wire AudioContext / AnalyserNode yourself and feed samples as props.
- Frequency-domain data — use spectrum-chart or spectrogram instead.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                | Required | Default | Description                                                                                                             |
| --------------------- | --------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                            | no       | —       |                                                                                                                         |
| `data`                | `number`[]                                          | yes      | —       |                                                                                                                         |
| `dataTableCaption`    | `string`                                            | no       | —       |                                                                                                                         |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"` | no       | —       |                                                                                                                         |
| `description`         | `string`                                            | no       | —       |                                                                                                                         |
| `height`              | `number`                                            | no       | —       |                                                                                                                         |
| `label`               | `string`                                            | yes      | —       |                                                                                                                         |
| `loading`             | `boolean`                                           | no       | —       |                                                                                                                         |
| `renderMode`          | `"path"` \| `"bars"`                                | no       | —       |                                                                                                                         |
| `empty`               | `(opaque)`                                          | no       | —       | Snippet rendered when the chart has no data. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                          | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
