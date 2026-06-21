import type { HTMLAttributes } from 'svelte/elements';

/** Layout mode: compact icon-only or expanded icon+label. */
export type MediaControlsLayout = 'compact' | 'expanded';

/** Props for the MediaControls component. */
export type MediaControlsProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Current playback state. @default "paused" */
  playing?: boolean;
  /** Show a replay action instead of play/pause when the track has ended. @default false */
  replay?: boolean;
  /** Disable all controls. @default false */
  disabled?: boolean;
  /** Show a loading spinner and prevent interaction while media is buffering. @default false */
  loading?: boolean;
  /** Controls are unavailable (e.g. media source missing). @default false */
  unavailable?: boolean;
  /** Progress value between 0 and 1. Omit to hide the progress bar. */
  progress?: number;
  /** Human-readable accessible label for the progress bar. @default "Playback progress" */
  progressLabel?: string;
  /** Layout mode: `compact` renders icon-only, `expanded` renders icon+label. @default "compact" */
  layout?: MediaControlsLayout;
  /** Called when the user triggers playback. */
  onplay?: () => void;
  /** Called when the user pauses playback. */
  onpause?: () => void;
  /** Called when the user triggers replay. */
  onreplay?: () => void;
  /** Additional class names merged with `.cinder-media-controls`. */
  class?: string;
};

/**
 * Cinder-specific props for MediaControls, used by the schema generator.
 */
export interface MediaControlsSchemaProps {
  /**
   * Whether playback is active.
   * @default false
   */
  playing?: boolean;
  /**
   * Show a replay action when the track has ended.
   * @default false
   */
  replay?: boolean;
  /**
   * Disable all controls.
   * @default false
   */
  disabled?: boolean;
  /**
   * Show loading state while media is buffering.
   * @default false
   */
  loading?: boolean;
  /**
   * Controls are unavailable.
   * @default false
   */
  unavailable?: boolean;
  /** Progress value between 0 and 1. Omit to hide the progress bar. */
  progress?: number;
  /** Accessible label for the progress bar. */
  progressLabel?: string;
  /**
   * Layout mode.
   * @default "compact"
   */
  layout?: MediaControlsLayout;
  /** Additional class names merged with `.cinder-media-controls`. */
  class?: string;
  /** Called when the play action is triggered. */
  onplay?: () => void;
  /** Called when the pause action is triggered. */
  onpause?: () => void;
  /** Called when the replay action is triggered. */
  onreplay?: () => void;
}
