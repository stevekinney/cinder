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
  /** Controls the open state of the card; bindable for controlled usage. */
  open?: boolean;
  onopenchange?: (open: boolean) => void;
  /** Delay in milliseconds before the card opens after the pointer enters or focus lands on the trigger. Default `300`. */
  openDelay?: number;
  /** Delay in milliseconds before the card closes after the pointer leaves and focus departs. Default `150`. */
  closeDelay?: number;
  /** Preferred placement of the card relative to the trigger. Default `bottom-start`. */
  placement?: HoverCardPlacement;
  /** Distance in pixels between the trigger and the card. Default `8`. */
  offset?: number;
  /** When true, renders a directional arrow pointing from the card toward the trigger. Default `false`. */
  showArrow?: boolean;
  trigger: Snippet;
  children: Snippet;
  triggerRef?: HTMLElement | null;
  /** Visually hidden text wired to the trigger via aria-describedby for assistive technology context. */
  description?: string;
  /** Additional class names merged with the component's root class. */
  class?: string;
};
