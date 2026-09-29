import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type ZoomPanViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Additional class merged with the component's root class. */
  class?: string;
  /** Content the viewer pans and zooms. */
  children: Snippet;
  /**
   * Starting zoom scale. Bindable, but clamping is render-only: an
   * out-of-range or non-finite value is clamped to `0.25`–`8` (or
   * normalized to `1` if non-finite) only in the transform actually
   * rendered—the bound `scale` value itself is left as the caller set it
   * and is not written back, so a parent observes its own out-of-range or
   * non-finite value until an internal pointer/keyboard/control
   * interaction calls `update()` and overwrites it. A programmatic
   * external change to this prop does not itself fire `onTransformChange`
   * (see that prop). Defaults to `1`.
   * @default 1
   */
  scale?: number;
  /**
   * Names the viewport. Does not describe the diagram itself. Defaults to
   * `'Zoomable viewer'`.
   * @default 'Zoomable viewer'
   */
  ariaLabel?: string;
  /**
   * Called with `{ scale, x, y }` after a pointer, keyboard, or control
   * interaction runs, whether or not that interaction actually changed the
   * transform—zooming in at the already-clamped `8` maximum, or resetting
   * when already at the initial `{ scale: 1, x: 0, y: 0 }`, still calls
   * this with the same values. Don't treat every call as a real change;
   * compare against the previous transform if that matters. Not called
   * when `scale` changes only because the caller passed a new value
   * externally—hosts that need to react to that must watch `scale`
   * themselves.
   */
  onTransformChange?: (transform: { scale: number; x: number; y: number }) => void;
};
