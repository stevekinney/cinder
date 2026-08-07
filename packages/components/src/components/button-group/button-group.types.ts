import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Visual/layout orientation of the group. */
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
type ButtonGroupBase = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'role' | 'aria-label' | 'aria-labelledby'
> & {
  /** Orientation of the visual collapse. Default: 'horizontal'. @default "horizontal" */
  orientation?: ButtonGroupOrientation;
  /** Additional class merged with `.cinder-button-group`. */
  class?: string;
  /** Buttons (or split-button compositions) to render inside the group. */
  children: Snippet;
};
/**
 * Layout-only grouping container for related action buttons.
 * Requires an accessible name via either `label` (for inline labelling)
 * or `ariaLabelledby` (when a visible heading already names the group).
 * Exactly one must be provided.
 */
export type ButtonGroupProps = ButtonGroupBase &
  (
    | {
        /** Inline accessible name for the group, applied as `aria-label`. Provide exactly one of `label` or `ariaLabelledby`. */
        label: string;
        ariaLabelledby?: never;
      }
    | {
        label?: never;
        /** The `id` of a visible heading element that already names the group, applied as `aria-labelledby`. Provide exactly one of `label` or `ariaLabelledby`. */
        ariaLabelledby: string;
      }
  );
