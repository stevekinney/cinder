<script lang="ts" module>
  export const title = 'Frequency spectrum';
  export const description =
    'Pre-computed FFT magnitude spectrum showing frequency content of a signal.';
</script>

<script lang="ts">
  import { SpectrumChart } from '@lostgradient/cinder/spectrum-chart';

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
