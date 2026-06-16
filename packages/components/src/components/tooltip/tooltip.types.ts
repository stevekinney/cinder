import type { Snippet } from 'svelte';
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
export type TooltipProps = {
  /** Text content rendered inside the tooltip. */
  text: string;
  /** Preferred side of the trigger on which the tooltip appears. Default `top`. */
  placement?: TooltipPlacement;
  /** Whether to wire tooltip text to the trigger via aria-describedby. */
  describe?: boolean;
  /** Additional class names merged with the component's root class. */
  class?: string;
  /** The trigger element that the tooltip is anchored to. */
  children: Snippet;
};
