import type { HTMLAttributes } from 'svelte/elements';
import type { SvelteSet } from 'svelte/reactivity';
import type { IconComponent } from '../icons/index.ts';
export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconComponent;
  controls?: string | undefined;
  disabled?: boolean;
};
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
  hideLabel?: boolean;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Visual size of the control. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Opt the control into a shared toolbar height (via
   * `--cinder-control-height-sm`) so it lines up cleanly with sibling
   * `Button` (size="sm"), `Chip` (density="toolbar"), and other toolbar
   * elements. Default rendering is unchanged.
   */
  density?: 'toolbar';
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Show options as detached individual buttons instead of a unified strip. */
  detached?: boolean;
  /** Stretch the control to fill available width. */
  fullWidth?: boolean;
  /** ARIA interaction pattern. Use `tablist` when options switch visible panels. */
  variant?: 'radiogroup' | 'tablist';
  /** Available options. */
  options: readonly SegmentedControlOption<T>[];
  /** Additional class names merged with `.cinder-segmented-control`. */
  class?: string;
  /** Called when the selected value changes. */
  onchange?: (value: T) => void;
};
type SingleProps<T extends string> = CommonProps<T> & {
  selectionMode?: 'single';
  /** Selected option value. */
  value?: T;
  /**
   * When true (default), clicking the already-selected option is a no-op.
   * When false, clicking the selected option clears value to undefined.
   */
  disallowEmptySelection?: boolean;
};
type MultipleProps<T extends string> = CommonProps<T> & {
  selectionMode: 'multiple';
  /** Set of selected option values. Must be a SvelteSet for reactivity. */
  value?: SvelteSet<T>;
  /** Not applicable in multiple mode — present for Svelte destructuring compatibility. */
  disallowEmptySelection?: undefined;
  /** Tablist semantics are only valid for single selection. */
  variant?: 'radiogroup';
};
export type SegmentedControlProps<T extends string = string> = SingleProps<T> | MultipleProps<T>;
