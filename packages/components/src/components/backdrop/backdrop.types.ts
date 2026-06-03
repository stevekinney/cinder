import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type BackdropProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'onclick'> & {
  /** Whether the backdrop is visible and active. */
  open: boolean;
  /**
   * When true the backdrop is transparent but still captures pointer events,
   * enabling click-to-close without dimming content behind it.
   * @default false
   */
  invisible?: boolean;
  /**
   * Lock body scroll while the backdrop is open (counted lock — safe to nest
   * with other overlays). Set false when the consumer manages scrolling itself.
   * @default true
   */
  lockScroll?: boolean;
  /**
   * Enter/leave animation duration in milliseconds. Collapses to 0 under
   * `prefers-reduced-motion`. Overrides the default when provided.
   */
  transitionDuration?: number;
  /** Click handler — use this to wire click-to-close on the scrim. */
  onclick?: (event: MouseEvent) => void;
  /** Additional class names merged onto the root element. */
  class?: string;
  /** Optional content rendered above the scrim (e.g. a Spinner for a loading state). */
  children?: Snippet;
};
