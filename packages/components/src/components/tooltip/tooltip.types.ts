import type { Snippet } from 'svelte';
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
export type TooltipProps = {
  text: string;
  placement?: TooltipPlacement;
  /** Whether to wire tooltip text to the trigger via aria-describedby. */
  describe?: boolean;
  class?: string;
  children: Snippet;
};
