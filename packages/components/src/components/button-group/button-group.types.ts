import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Visual/layout orientation of the group. */
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
type ButtonGroupBase = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'role' | 'aria-label' | 'aria-labelledby'
> & {
  /** Orientation of the visual collapse. Default: 'horizontal'. */
  orientation?: ButtonGroupOrientation;
  /** Additional class merged with `.cinder-button-group`. */
  class?: string;
  /** Buttons (or split-button compositions) to render inside the group. */
  children: Snippet;
};
/**
 * Layout-only grouping container for related action buttons.
 * Requires an accessible name via either `label` (for inline labelling)
 * or `labelledBy` (when a visible heading already names the group).
 * Exactly one must be provided.
 */
export type ButtonGroupProps = ButtonGroupBase &
  ({ label: string; labelledBy?: never } | { label?: never; labelledBy: string });
