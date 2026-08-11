# Waveform

Responsive SVG rendering of time-domain audio amplitude data as a waveform path or bar display.

## Usage

```svelte
<script lang="ts">
  import Waveform from '@lostgradient/cinder/waveform';
</script>

<Waveform label="Voice recording waveform" data={[]} height={80}>
  {#snippet empty()}
    No recording captured yet.
  {/snippet}
</Waveform>
```

## Guidance

### Use When

- Visualizing pre-recorded or pre-processed audio amplitude samples in a static display.
- Showing an audio waveform thumbnail or preview with mocked or pre-computed sample data.

### Avoid When

- Real-time live audio capture is needed — wire AudioContext / AnalyserNode yourself and feed samples as props.
- Frequency-domain data — use spectrum-chart or spectrogram instead.

## Rendering and theming

Waveform uses SVG, inherits its foreground from `currentColor`, defaults its background to transparent, and resolves the path or bars through the first `--cinder-chart-series-*` color. Pass a partial `theme` to override the palette or chart colors, including the rendered chart background. Buffers above 2,000 rendered points use a min/max envelope so peaks remain visible without creating an unbounded SVG; the data-table caption reports when its readable sample is truncated.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                                                                      | Required | Default | Description                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                                                                                  | no       | —       | Custom class applied to the root element.                                                                               |
| `data`                | `number`[]                                                                                                | yes      | —       | Time-domain amplitude samples. Each value should be in the range [-1, 1]; values outside this range are clamped.        |
| `dataTableCaption`    | `string`                                                                                                  | no       | —       | Custom data table caption; falls back to `label`.                                                                       |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                       | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                           |
| `description`         | `string`                                                                                                  | no       | —       | Optional description rendered below the label.                                                                          |
| `height`              | `number`                                                                                                  | no       | —       | Pixel height of the chart. Default `80`.                                                                                |
| `label`               | `string`                                                                                                  | yes      | —       | Accessible label for the waveform. Required for screen readers.                                                         |
| `loading`             | `boolean`                                                                                                 | no       | —       | Whether the waveform is in a loading state. Default `false`.                                                            |
| `renderMode`          | `"path"` \| `"bars"`                                                                                      | no       | —       | How to render the waveform: as a continuous path or vertical amplitude bars. Default `path`.                            |
| `theme`               | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] } | no       | —       | Partial visual theme override. Omitted fields inherit the surrounding application.                                      |
| `empty`               | `(opaque)`                                                                                                | no       | —       | Snippet rendered when the chart has no data. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                                                                                | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
