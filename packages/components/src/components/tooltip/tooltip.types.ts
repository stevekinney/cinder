import type { Snippet } from 'svelte';
export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
export type TooltipProps = {
  /** Text content rendered inside the tooltip. */
  text: string;
  /** Preferred side of the trigger on which the tooltip appears. Default `top`. */
  placement?: TooltipPlacement;
  /** Whether to wire tooltip text to the trigger via aria-describedby. @default true */
  describe?: boolean;
  /** Additional class names merged with the component's root class. */
  class?: string;
  /**
   * Explicit anchor element, for when the tooltip cannot wrap its trigger.
   *
   * The default form renders a wrapper around `children` and resolves the
   * anchor from it, which puts the `role="tooltip"` panel inside whatever
   * structure the trigger sits in. That is wrong wherever the surrounding
   * markup constrains its children — `AvatarGroup` wraps each avatar in a
   * `role="listitem"`, so an in-tree panel lands inside a list item.
   *
   * With `triggerRef`, the Tooltip renders ONLY the panel and anchors it to the
   * supplied element, so the consumer places the panel wherever it belongs.
   * `children` is then unnecessary — the trigger is already in the consumer's
   * own markup. Mirrors `PopoverProps.triggerRef`.
   */
  triggerRef?: HTMLElement | null;
  /**
   * The trigger element the tooltip wraps and anchors to. Required unless
   * `triggerRef` supplies the anchor instead.
   */
  children?: Snippet;
};
