<script lang="ts" module>
  export const title = 'Audio waveform (bars mode)';
  export const description =
    'Pre-computed audio amplitude samples rendered as vertical amplitude bars.';
</script>

<script lang="ts">
  import { Waveform } from '@lostgradient/cinder/waveform';

  // Simulate a voice recording envelope (louder in the middle) with deterministic noise
  const voiceData = Array.from({ length: 128 }, (_, index) => {
    const envelope = Math.sin((index / 128) * Math.PI);
    // Deterministic pseudo-noise using multiple harmonics
    const noise = (Math.sin(index * 7.3) + Math.sin(index * 13.7) + Math.sin(index * 23.1)) / 7.5;
    return Math.max(-1, Math.min(1, envelope * 0.8 + noise));
  });
</script>

<Waveform
  label="Voice recording waveform"
  description="Simulated voice recording amplitude envelope displayed as bars."
  data={voiceData}
  renderMode="bars"
  height={80}
/>
