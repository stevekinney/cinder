<script lang="ts" module>
  export const title = 'Custom range';
  export const description = 'Use a max value when the measurement is not fractional.';
</script>

<script lang="ts">
  import { Sparkbar } from '@lostgradient/cinder/sparkbar';
</script>

<div style="display: grid; gap: 0.75rem; max-width: 28rem;">
  <Sparkbar value={4200} max={8000} label="Prompt tokens" trailing="4.2k / 8k" />
  <Sparkbar value={7100} max={8000} label="Completion tokens" trailing="7.1k / 8k" size="lg" />
</div>
