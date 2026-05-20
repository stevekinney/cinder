import type { Snippet } from 'svelte';
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
export type ChipDisplayProps = {
  mode?: 'display';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  id?: string;
  title?: string;
  onpressedchange?: never;
  onremove?: never;
  [key: `data-${string}`]: string | number | boolean | undefined;
};
export type ChipToggleProps = {
  mode: 'toggle';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  id?: string;
  title?: string;
  pressed: boolean;
  onpressedchange?: (pressed: boolean) => void;
  disabled?: boolean;
  onclick?: (event: MouseEvent) => void;
  'aria-label'?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
};
export type ChipRemovableProps = {
  mode: 'removable';
  label: string;
  variant?: ChipVariant;
  size?: ChipSize;
  density?: ChipDensity;
  leadingIcon?: Snippet;
  class?: string;
  id?: string;
  title?: string;
  onremove?: () => void;
  disabled?: boolean;
  removeAriaLabel?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
};
export type ChipProps = ChipDisplayProps | ChipToggleProps | ChipRemovableProps;
