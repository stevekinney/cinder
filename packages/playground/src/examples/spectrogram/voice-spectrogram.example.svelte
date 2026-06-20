<script lang="ts" module>
  export const title = 'Voice spectrogram';
  export const description =
    'Time × frequency heatmap showing how frequency content changes over time.';
  export const featured = true;
</script>

<script lang="ts">
  import { Spectrogram } from '@lostgradient/cinder/spectrogram';

  const frequencyLabels = [
    '50 Hz',
    '100 Hz',
    '200 Hz',
    '400 Hz',
    '800 Hz',
    '1.6 kHz',
    '3.2 kHz',
    '6.4 kHz',
  ];

  // Simulate a vowel formant pattern changing over time
  function makeFrame(
    label: string,
    formant1: number,
    formant2: number,
  ): { label: string; bins: number[] } {
    return {
      label,
      bins: frequencyLabels.map((_, index) => {
        const f1 = Math.exp(-Math.pow(index - formant1, 2) / 1.5) * 0.9;
        const f2 = Math.exp(-Math.pow(index - formant2, 2) / 1.5) * 0.6;
        // Deterministic micro-variation using index and formant positions
        const microVariation = Math.sin(index * 17.3 + formant1 * 5.7) * 0.025;
        return Math.min(1, f1 + f2 + Math.abs(microVariation));
      }),
    };
  }

  const frames = [
    makeFrame('0 ms', 1, 4),
    makeFrame('20 ms', 1.2, 4.2),
    makeFrame('40 ms', 1.5, 4.5),
    makeFrame('60 ms', 2, 5),
    makeFrame('80 ms', 2.5, 5.5),
    makeFrame('100 ms', 2.2, 5.2),
    makeFrame('120 ms', 1.8, 4.8),
    makeFrame('140 ms', 1.5, 4.5),
    makeFrame('160 ms', 1.2, 4.2),
    makeFrame('180 ms', 1, 4),
  ];
</script>

<Spectrogram
  label="Voice spectrogram — vowel formant transition"
  description="Time × frequency heatmap showing vowel formant frequency shifts over 180 ms."
  {frames}
  {frequencyLabels}
  height={220}
  dataTableVisibility="visible"
/>
