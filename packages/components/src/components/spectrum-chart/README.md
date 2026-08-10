# SpectrumChart

Responsive SVG frequency-bin bar chart for visualizing audio spectrum magnitude data.

## Usage

```svelte
<script lang="ts">
  import SpectrumChart from '@lostgradient/cinder/spectrum-chart';

  // Simulate a spectrum with a peak around 440 Hz (A4 note)
  const bins = [
    { label: '55 Hz', value: 0.02 },
    { label: '110 Hz', value: 0.05 },
    { label: '220 Hz', value: 0.12 },
    { label: '330 Hz', value: 0.18 },
    { label: '440 Hz', value: 0.95 },
    { label: '550 Hz', value: 0.15 },
    { label: '660 Hz', value: 0.08 },
    { label: '880 Hz', value: 0.04 },
    { label: '1.1 kHz', value: 0.03 },
    { label: '1.3 kHz', value: 0.02 },
    { label: '1.76 kHz', value: 0.01 },
    { label: '2.2 kHz', value: 0.005 },
  ];
</script>

<SpectrumChart
  label="Frequency spectrum — A4 note (440 Hz)"
  description="Magnitude spectrum of a 440 Hz sine wave showing the fundamental and harmonics."
  {bins}
  height={180}
  dataTableVisibility="visible"
/>
```

## Guidance

### Use When

- Displaying pre-computed frequency-domain magnitude data from an FFT or spectrum analyzer.
- Showing a static frequency response or spectrum snapshot with labelled frequency bins.

### Avoid When

- Real-time live audio spectrum is needed — feed live AnalyserNode data as props yourself.
- A full time × frequency heatmap is needed — use spectrogram instead.
- General categorical bar comparison — use bar-chart instead.

## Rendering and theming

SpectrumChart uses SVG and derives guide margins from its formatted frequency and magnitude labels. Its foreground follows `currentColor`, its background remains transparent, and the spectrum marks use the first resolved `--cinder-chart-series-*` color. Pass a partial `theme` to override only the palette or chart colors you need; the semantic data table remains available independently of the visual theme.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                                                                      | Required | Default | Description                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `bins`                | { label: `string`; value: `number` }[]                                                                    | yes      | —       | Frequency bins with label + magnitude value.                                                                        |
| `class`               | `string`                                                                                                  | no       | —       | Custom class applied to the root element.                                                                           |
| `dataTableCaption`    | `string`                                                                                                  | no       | —       | Custom data table caption; falls back to `label`.                                                                   |
| `dataTableVisibility` | `"screen-reader-only"` \| `"visible"` \| `"hidden"`                                                       | no       | —       | Controls data table visibility. Default `screen-reader-only`.                                                       |
| `description`         | `string`                                                                                                  | no       | —       | Optional description rendered below the label.                                                                      |
| `height`              | `number`                                                                                                  | no       | —       | Pixel height of the chart. Default `160`.                                                                           |
| `label`               | `string`                                                                                                  | yes      | —       | Accessible label for the chart. Required for screen readers.                                                        |
| `loading`             | `boolean`                                                                                                 | no       | —       | Whether the chart is in a loading state. Default `false`.                                                           |
| `theme`               | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] } | no       | —       | Partial visual theme override. Omitted fields inherit the surrounding application.                                  |
| `empty`               | `(opaque)`                                                                                                | no       | —       | Snippet rendered when there are no bins. Not expressible in JSON Schema; see the component types for the signature. |
| `loadingContent`      | `(opaque)`                                                                                                | no       | —       | Snippet rendered while loading. Not expressible in JSON Schema; see the component types for the signature.          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
