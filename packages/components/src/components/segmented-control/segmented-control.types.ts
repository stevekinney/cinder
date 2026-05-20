import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SvelteSet } from 'svelte/reactivity';

type ComponentOwnedAttributes =
  | 'id'
  | 'class'
  | 'role'
  | 'tabindex'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-disabled'
  | 'aria-orientation'
  | 'onchange'
  | 'onkeydown';

type CommonProps<T extends string> = Omit<
  HTMLAttributes<HTMLDivElement>,
  ComponentOwnedAttributes
> & {
  /** Unique identifier for the control. */
  id: string;
  /** Accessible label for the group. */
  label: string;
  /** Visually hide the label while keeping it available to assistive technology. */
  hideLabel?: boolean | undefined;
  /** Disable the whole control. */
  disabled?: boolean | undefined;
  /** Visual size of the control. */
  size?: 'sm' | 'md' | 'lg' | undefined;
  /**
   * Opt the control into a shared toolbar height (via
   * `--cinder-control-height-sm`) so it lines up cleanly with sibling
   * `Button` (size="sm"), `Chip` (density="toolbar"), and other toolbar
   * elements. Default rendering is unchanged.
   */
  density?: 'toolbar' | undefined;
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical' | undefined;
  /** Render segments as detached individual buttons instead of a unified strip. */
  detached?: boolean | undefined;
  /** Stretch the control to fill available width. */
  fullWidth?: boolean | undefined;
  /** ARIA interaction pattern. Use `tablist` when options switch visible panels. */
  variant?: 'radiogroup' | 'tablist' | undefined;
  /** Additional class names merged with `.cinder-segmented-control`. */
  class?: string | undefined;
  /** Called when the selected value changes (single mode only). */
  onchange?: ((value: T) => void) | undefined;
  /** Child `<Segment>` elements. */
  children: Snippet;
};

type SingleProps<T extends string> = CommonProps<T> & {
  selectionMode?: 'single' | undefined;
  /** Currently selected value. */
  value?: T | undefined;
  /**
   * When true (default), clicking the already-selected option is a no-op.
   * When false, clicking the selected option clears value to undefined.
   */
  disallowEmptySelection?: boolean | undefined;
};

type MultipleProps<T extends string> = CommonProps<T> & {
  selectionMode: 'multiple';
  /** Set of selected values. Must be a SvelteSet for reactivity. */
  value?: SvelteSet<T> | undefined;
  /** Not applicable in multiple mode — present for Svelte destructuring compatibility. */
  disallowEmptySelection?: undefined;
  /** Tablist semantics are only valid for single selection. */
  variant?: 'radiogroup' | undefined;
};

export type SegmentedControlProps<T extends string = string> = SingleProps<T> | MultipleProps<T>;
