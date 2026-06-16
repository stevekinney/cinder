<script lang="ts" module>
  export const title = 'Empty state';
  export const description =
    'When `data` is empty, supply an `empty` snippet to explain the absence instead of rendering a flat, meaningless plot.';
</script>

<script lang="ts">
  import { Waveform } from '@lostgradient/cinder/waveform';
</script>

<Waveform label="Voice recording waveform" data={[]} height={80}>
  {#snippet empty()}
    No recording captured yet.
  {/snippet}
</Waveform>
