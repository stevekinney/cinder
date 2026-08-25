import type { HTMLAttributes } from 'svelte/elements';
export type SelectionPopoverPosition = {
  x: number;
  y: number;
  /**
   * Height of the selection rect in CSS pixels. When provided, the virtual
   * anchor exposes the correct `bottom` edge (`y + height`) to floating-ui so
   * that `flip` places the panel below the selection's actual bottom edge
   * instead of overlapping it. Defaults to 0 when omitted (zero-height point
   * anchor — the original behaviour, which causes overlap when flipped).
   */
  height?: number;
};
export type SelectionPopoverProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Unique identifier for the popover. */
  id: string;
  /** Viewport-relative anchor point for the popover. */
  position: SelectionPopoverPosition | null;
  /** Whether the popover is visible. */
  open?: boolean;
  /** Called when a comment is submitted. */
  onCommentSubmit?: (body: string) => void;
  /** Called when the compact action expands into the composer. */
  onExpand?: () => void;
  /** Called when the composer is canceled. */
  onCancel?: () => void;
  /** Called when the popover should close. */
  onClose?: () => void;
  /**
   * Called once the popover's exit transition has genuinely finished and it
   * has fully unmounted from the layout (see `_internal/OVERLAY-POLICY.md` §
   * "Transition lifecycle"). This component intentionally never unmounts
   * ITS OWN root element while closing — `data-cinder-visible`/
   * `data-cinder-closing` drive the retained fade instead of an `{#if}` gate
   * — so a consumer that wraps this component in its own `{#if}` keyed
   * directly on the same state that flips `open` false would destroy the
   * whole component instance before its exit transition ever gets a chance
   * to play. Use this callback to decouple that wrapping condition from the
   * live open state: keep the consumer's own mount gate true until this
   * fires, then clear it.
   */
  onExitComplete?: () => void;
  /** Additional class names merged with `.cinder-selection-popover`. */
  class?: string;
};
