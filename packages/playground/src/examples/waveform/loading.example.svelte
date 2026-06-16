<script lang="ts" module>
  export const title = 'Loading state';
  export const description =
    'While audio is being decoded, set `loading` and supply a `loadingContent` snippet to render a placeholder over the viewport instead of the plot.';
</script>

<script lang="ts">
  import { Waveform } from '@lostgradient/cinder/waveform';
</script>

<Waveform label="Voice recording waveform" data={[]} height={80} loading>
  {#snippet loadingContent()}
    Decoding audio…
  {/snippet}
</Waveform>
