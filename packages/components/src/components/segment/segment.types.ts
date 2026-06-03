import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

// Attributes the component owns and computes itself, so a consumer value would
// be silently overridden. `onfocus` / `onblur` are intentionally NOT here: the
// component implements no focus handling, so forwarding them through `...rest`
// lets consumers wire focus-driven behavior (tooltips, analytics) on a segment.
type SegmentOwnedAttributes =
  | 'role'
  | 'type'
  | 'disabled'
  | 'tabindex'
  | 'class'
  | 'aria-checked'
  | 'aria-selected'
  | 'aria-pressed'
  | 'aria-controls'
  | 'aria-disabled'
  | 'onclick';

export type SegmentProps = Omit<HTMLButtonAttributes, SegmentOwnedAttributes> & {
  /** Value this segment represents. Must be unique within the parent control. */
  value: string;
  /** Custom class merged with `.cinder-segmented-control-option`. */
  class?: string | undefined;
  /** Disable just this segment (independent of the control-level `disabled`). */
  disabled?: boolean | undefined;
  /**
   * ID of the panel this segment controls — only meaningful when the parent
   * `SegmentedControl` uses `variant="tablist"`.
   */
  controls?: string | undefined;
  /** Optional decorative content rendered before the label, inside `aria-hidden`. */
  leading?: Snippet | undefined;
  /** Optional decorative content rendered after the label, inside `aria-hidden`. */
  trailing?: Snippet | undefined;
  /** The segment's label content. */
  children: Snippet;
};
