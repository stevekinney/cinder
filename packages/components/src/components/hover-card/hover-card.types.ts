import type { Snippet } from 'svelte';

export type HoverCardPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end';

export type HoverCardProps = {
  open?: boolean;
  onopenchange?: (open: boolean) => void;
  openDelay?: number;
  closeDelay?: number;
  placement?: HoverCardPlacement;
  offset?: number;
  showArrow?: boolean;
  trigger: Snippet;
  children: Snippet;
  triggerRef?: HTMLElement | null;
  description?: string;
  class?: string;
};
