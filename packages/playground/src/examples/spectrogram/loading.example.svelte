<script lang="ts" module>
  export const title = 'Loading state';
  export const description =
    'While frames are still being analyzed, set `loading` and supply a `loadingContent` snippet to render a placeholder over the heatmap.';
</script>

<script lang="ts">
  import { Spectrogram } from '@lostgradient/cinder/spectrogram';
</script>

<Spectrogram label="Voice spectrogram" frames={[]} height={220} loading>
  {#snippet loadingContent()}
    Analyzing frequencies…
  {/snippet}
</Spectrogram>
