import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type { BadgeVariant } from '../badge/badge.types.ts';
export type ChipVariant = BadgeVariant;
export type ChipSize = 'sm' | 'md';
export type ChipMode = 'display' | 'toggle' | 'removable';
/**
 * Opt the chip into a shared toolbar height (via `--cinder-control-height-sm`)
 * so it lines up with sibling Button (size="sm") and SegmentedControl
 * (density="toolbar"). Default rendering is unchanged.
 */
export type ChipDensity = 'toolbar';
export type ChipDisplayProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  mode?: 'display';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  // Cross-variant sentinel props: present as `never` so the union is destructurable in chip.svelte,
  // and consumers get a compile-time error if they pass toggle/removable-only props to display mode.
  pressed?: never;
  disabled?: never;
  onpressedchange?: never;
  onremove?: never;
  removeAriaLabel?: never;
};
// `aria-pressed` is owned (set from the `pressed` prop) and `type` is always `"button"`
// (a toggle chip must never become a form submitter), so both are Omit-ted — a consumer
// value would be silently overridden. `onclick` and `aria-label` are intentionally NOT
// omitted: the component consumes them (wraps onclick, suppresses empty aria-label)
// rather than discarding them.
export type ChipToggleProps = Omit<
  HTMLButtonAttributes,
  'class' | 'disabled' | 'aria-pressed' | 'type'
> & {
  mode: 'toggle';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  pressed: boolean;
  onpressedchange?: (pressed: boolean) => void;
  disabled?: boolean;
  // Cross-variant sentinel props
  onremove?: never;
  removeAriaLabel?: never;
};
export type ChipRemovableProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  mode: 'removable';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  onremove?: () => void;
  disabled?: boolean;
  removeAriaLabel?: string;
  // Cross-variant sentinel props
  pressed?: never;
  onpressedchange?: never;
};
export type ChipProps = ChipDisplayProps | ChipToggleProps | ChipRemovableProps;
