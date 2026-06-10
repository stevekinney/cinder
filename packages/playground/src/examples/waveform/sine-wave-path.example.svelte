<script lang="ts" module>
  export const title = 'Sine wave (path mode)';
  export const description = 'A time-domain sine wave rendered as a continuous SVG path.';
</script>

<script lang="ts">
  import { Waveform } from '@lostgradient/cinder/waveform';

  const sineData = Array.from({ length: 256 }, (_, index) => Math.sin((index / 256) * Math.PI * 8));
</script>

<Waveform
  label="Sine wave — 4 Hz"
  description="A pure 4 Hz sine wave sampled at 256 points, displayed in path mode."
  data={sineData}
  renderMode="path"
  height={100}
  dataTableVisibility="visible"
/>
