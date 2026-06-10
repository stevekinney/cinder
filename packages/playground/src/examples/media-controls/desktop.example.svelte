<script lang="ts" module>
  export const title = 'Desktop media controls';
  export const description =
    'Play, pause, and replay actions with optional progress. Compact icon-only layout suitable for a toolbar.';
</script>

<script lang="ts">
  import { MediaControls } from '@lostgradient/cinder/media-controls';

  let playing = $state(false);
  let progress = $state<number | undefined>(undefined);

  const isReplay = $derived(progress !== undefined && !playing && progress >= 1);

  function handlePlay() {
    playing = true;
    progress = 0;
    // Simulate progress.
    const interval = setInterval(() => {
      progress = (progress ?? 0) + 0.05;
      if ((progress ?? 0) >= 1) {
        clearInterval(interval);
        playing = false;
        progress = 1;
      }
    }, 200);
  }

  function handlePause() {
    playing = false;
  }

  function handleReplay() {
    playing = false;
    progress = 0;
    setTimeout(() => handlePlay(), 100);
  }
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  {#if progress !== undefined}
    <MediaControls
      {playing}
      replay={isReplay}
      {progress}
      onPlay={handlePlay}
      onPause={handlePause}
      onReplay={handleReplay}
    />
    <MediaControls
      {playing}
      replay={isReplay}
      {progress}
      layout="expanded"
      onPlay={handlePlay}
      onPause={handlePause}
      onReplay={handleReplay}
    />
  {:else}
    <MediaControls
      {playing}
      replay={isReplay}
      onPlay={handlePlay}
      onPause={handlePause}
      onReplay={handleReplay}
    />
    <MediaControls
      {playing}
      replay={isReplay}
      layout="expanded"
      onPlay={handlePlay}
      onPause={handlePause}
      onReplay={handleReplay}
    />
  {/if}
</div>
