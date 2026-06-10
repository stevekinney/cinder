<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status alpha
   * @purpose Accessible playback controls for play, pause, and replay actions with optional progress display.
   * @tag action
   * @tag media
   * @useWhen Embedding play/pause/replay controls for audio or video content.
   * @useWhen Rendering media controls inside a toolbar or standalone on a card.
   * @avoidWhen You need waveform visualization or Web Audio integration — wire that separately.
   * @avoidWhen You need a full media player UI with seek scrubbing — use a dedicated player component.
   * @related button, toolbar, progress, tooltip
   */
  export type { MediaControlsLayout, MediaControlsProps } from './media-controls.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import type { MediaControlsProps } from './media-controls.types.ts';

  let {
    playing = false,
    replay = false,
    disabled = false,
    loading = false,
    unavailable = false,
    progress,
    progressLabel = 'Playback progress',
    layout = 'compact',
    onPlay,
    onPause,
    onReplay,
    class: customClassName,
    ...rest
  }: MediaControlsProps = $props();

  const isDisabled = $derived(disabled || loading || unavailable);
  const iconOnly = $derived(layout === 'compact');
  const hasProgress = $derived(typeof progress === 'number');
  const clampedProgress = $derived(
    typeof progress === 'number' ? Math.max(0, Math.min(1, progress)) : 0,
  );
  const progressPercent = $derived(Math.round(clampedProgress * 100));

  let announcement = $state('');

  function handlePlay() {
    if (isDisabled) return;
    announcement = 'Playing';
    onPlay?.();
  }

  function handlePause() {
    if (isDisabled) return;
    announcement = 'Paused';
    onPause?.();
  }

  function handleReplay() {
    if (isDisabled) return;
    announcement = 'Replaying';
    onReplay?.();
  }

  function handlePrimaryAction() {
    if (replay) {
      handleReplay();
    } else if (playing) {
      handlePause();
    } else {
      handlePlay();
    }
  }

  // The play/pause control is a TOGGLE button, so it keeps a STABLE label and
  // communicates on/off via aria-pressed — never both a changing label AND
  // aria-pressed (which makes AT announce confusing output like "Pause,
  // pressed"). Replay is a momentary action (changing label, no pressed state).
  // Loading / unavailable take precedence so the spoken name matches the visual.
  const isToggle = $derived(!loading && !unavailable && !replay);
  const primaryLabel = $derived(
    loading
      ? 'Loading playback controls'
      : unavailable
        ? 'Playback unavailable'
        : replay
          ? 'Replay'
          : 'Play or pause',
  );

  // aria-pressed applies only to the play/pause toggle (true while playing).
  const primaryPressed = $derived(isToggle ? (playing ? 'true' : 'false') : undefined);
</script>

<div
  {...rest}
  class={classNames('cinder-media-controls', customClassName)}
  data-cinder-layout={layout}
  data-cinder-playing={playing ? '' : undefined}
  data-cinder-loading={loading ? '' : undefined}
  data-cinder-unavailable={unavailable ? '' : undefined}
>
  <button
    type="button"
    class="cinder-media-controls__button"
    aria-label={primaryLabel}
    aria-pressed={primaryPressed}
    aria-disabled={isDisabled ? 'true' : undefined}
    aria-busy={loading ? 'true' : undefined}
    disabled={isDisabled}
    onclick={handlePrimaryAction}
    data-cinder-state={replay ? 'replay' : playing ? 'playing' : 'paused'}
  >
    {#if loading}
      <!-- Loading state: spinner-like indicator -->
      <span class="cinder-media-controls__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-media-controls__svg cinder-media-controls__svg--loading"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </span>
      {#if !iconOnly}
        <span class="cinder-media-controls__label">Loading</span>
      {/if}
    {:else if unavailable}
      <!-- Unavailable state -->
      <span class="cinder-media-controls__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-media-controls__svg"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </span>
      {#if !iconOnly}
        <span class="cinder-media-controls__label">Unavailable</span>
      {/if}
    {:else if replay}
      <!-- Replay icon -->
      <span class="cinder-media-controls__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="cinder-media-controls__svg"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </span>
      {#if !iconOnly}
        <span class="cinder-media-controls__label">Replay</span>
      {/if}
    {:else if playing}
      <!-- Pause icon -->
      <span class="cinder-media-controls__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="cinder-media-controls__svg"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </span>
      {#if !iconOnly}
        <span class="cinder-media-controls__label">Pause</span>
      {/if}
    {:else}
      <!-- Play icon -->
      <span class="cinder-media-controls__icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="cinder-media-controls__svg"
        >
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </span>
      {#if !iconOnly}
        <span class="cinder-media-controls__label">Play</span>
      {/if}
    {/if}
  </button>

  {#if hasProgress}
    <div
      class="cinder-media-controls__progress"
      role="progressbar"
      aria-label={progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPercent}
      aria-valuetext="{progressPercent}%"
    >
      <div class="cinder-media-controls__progress-track">
        <div class="cinder-media-controls__progress-fill" style:width="{progressPercent}%"></div>
      </div>
    </div>
  {/if}
</div>

<!-- Announce state changes to assistive technology via a polite live region. -->
<VisuallyHiddenLiveRegion message={announcement} />
