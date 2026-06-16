<script lang="ts" module>
  export const title = 'Empty state';
  export const description =
    'When no `frames` are available, supply an `empty` snippet to explain the absence instead of rendering a blank heatmap.';
</script>

<script lang="ts">
  import { Spectrogram } from '@lostgradient/cinder/spectrogram';
</script>

<Spectrogram label="Voice spectrogram" frames={[]} height={220}>
  {#snippet empty()}
    No audio analyzed yet.
  {/snippet}
</Spectrogram>
