import type { Snippet } from 'svelte';
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
export type TooltipProps = {
  text: string;
  placement?: TooltipPlacement;
  class?: string;
  children: Snippet;
};
