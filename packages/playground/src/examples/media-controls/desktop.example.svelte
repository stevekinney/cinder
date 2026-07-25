<script lang="ts" module>
  export const title = 'Desktop media controls';
  export const description =
    'Play, pause, and replay actions with optional progress. Compact icon-only layout suitable for a toolbar.';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  import { MediaControls } from '@lostgradient/cinder/media-controls';

  let playing = $state(false);
  let progress = $state<number | undefined>(undefined);

  const isReplay = $derived(progress !== undefined && !playing && progress >= 1);

  // The progress timer is hoisted so pause/replay can stop it. Keeping it local
  // to handlePlay would leak the interval on pause and stack a new one on every
  // Play click.
  let interval: ReturnType<typeof setInterval> | undefined;
  let replayTimer: ReturnType<typeof setTimeout> | undefined;

  function stopTimer() {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  function handlePlay() {
    playing = true;
    progress = 0;
    // Simulate progress. Clear any prior interval first so repeated Play clicks
    // don't stack timers.
    stopTimer();
    interval = setInterval(() => {
      progress = (progress ?? 0) + 0.05;
      if ((progress ?? 0) >= 1) {
        stopTimer();
        playing = false;
        progress = 1;
      }
    }, 200);
  }

  function handlePause() {
    playing = false;
    stopTimer();
  }

  function handleReplay() {
    stopTimer();
    playing = false;
    progress = 0;
    if (replayTimer !== undefined) clearTimeout(replayTimer);
    replayTimer = setTimeout(() => handlePlay(), 100);
  }

  onDestroy(() => {
    stopTimer();
    if (replayTimer !== undefined) clearTimeout(replayTimer);
  });
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
