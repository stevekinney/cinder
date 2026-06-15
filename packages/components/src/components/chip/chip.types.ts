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
  /** Rendering and interaction mode. Default `"display"`. */
  mode?: 'display';
  /** Visible text content of the chip. */
  label: string;
  /** Color variant applied to the chip. Default `"neutral"`. */
  variant?: ChipVariant;
  /** Size of the chip. Default `"md"`. */
  size?: ChipSize;
  /** When set to `"toolbar"`, opts the chip into compact toolbar sizing to align with sibling toolbar controls. */
  density?: ChipDensity;
  leadingIcon?: Snippet;
  /** Additional class names merged onto the chip element. */
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
  /** Rendering and interaction mode. Must be `"toggle"` for this variant. */
  mode: 'toggle';
  /** Visible text content of the chip. */
  label: string;
  /** Color variant applied to the chip. Default `"neutral"`. */
  variant?: ChipVariant;
  /** Size of the chip. Default `"md"`. */
  size?: ChipSize;
  /** When set to `"toolbar"`, opts the chip into compact toolbar sizing to align with sibling toolbar controls. */
  density?: ChipDensity;
  leadingIcon?: Snippet;
  /** Additional class names merged onto the chip element. */
  class?: string;
  /** Toggle mode only. Whether the chip is currently in the pressed (selected) state. Reflected as `aria-pressed`. */
  pressed: boolean;
  onpressedchange?: (pressed: boolean) => void;
  /** Toggle mode only. When true, disables the toggle button and prevents interaction. */
  disabled?: boolean;
  // Cross-variant sentinel props
  onremove?: never;
  removeAriaLabel?: never;
};
export type ChipRemovableProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /** Rendering and interaction mode. Must be `"removable"` for this variant. */
  mode: 'removable';
  /** Visible text content of the chip and fallback accessible name for the remove button. */
  label: string;
  /** Color variant applied to the chip. Default `"neutral"`. */
  variant?: ChipVariant;
  /** Size of the chip. Default `"md"`. */
  size?: ChipSize;
  /** When set to `"toolbar"`, opts the chip into compact toolbar sizing to align with sibling toolbar controls. */
  density?: ChipDensity;
  leadingIcon?: Snippet;
  /** Additional class names merged onto the chip element. */
  class?: string;
  onremove?: () => void;
  /** Removable mode only. When true, disables the remove button and prevents removal. */
  disabled?: boolean;
  /** Removable mode only. Accessible label for the remove button. Defaults to `Remove` followed by the chip's `label`. */
  removeAriaLabel?: string;
  // Cross-variant sentinel props
  pressed?: never;
  onpressedchange?: never;
};
export type ChipProps = ChipDisplayProps | ChipToggleProps | ChipRemovableProps;
