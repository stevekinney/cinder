import type { HTMLAttributes } from 'svelte/elements';
export type SelectionPopoverPosition = {
  x: number;
  y: number;
};
export type SelectionPopoverProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Unique identifier for the popover. */
  id: string;
  /** Viewport-relative anchor point for the popover. */
  position: SelectionPopoverPosition | null;
  /** Whether the popover is visible. */
  open?: boolean;
  /** Called when a comment is submitted. */
  oncommentsubmit?: (body: string) => void;
  /** Called when the compact action expands into the composer. */
  onexpand?: () => void;
  /** Called when the composer is canceled. */
  oncancel?: () => void;
  /** Called when the popover should close. */
  onclose?: () => void;
  /** Additional class names merged with `.cinder-selection-popover`. */
  class?: string;
};
