import type { Snippet } from 'svelte';

import type { FloatingActionButtonOnlyProps } from '../floating-action/floating-action.types.ts';

/** Label placement for a SpeedDial.Action. */
export type SpeedDialActionLabelPlacement = 'auto' | 'start' | 'end' | 'none';

// COR-239: this used to be `Extract<FloatingActionProps, { href?: undefined }>` — picking the
// button-only arm out of the `FloatingActionProps` union. Restructuring `FloatingActionProps`
// (see floating-action.types.ts) to avoid TS2590 made it a single intersection type rather than
// a union, so `Extract` can no longer pick an arm out of it; floating-action.types.ts now exports
// `FloatingActionButtonOnlyProps` directly for exactly this purpose.
type SpeedDialActionButtonAttributes = Omit<
  FloatingActionButtonOnlyProps,
  'aria-label' | 'children' | 'class' | 'disabled' | 'onclick' | 'size' | 'type'
>;

/** Props for the SpeedDialAction component. */
export type SpeedDialActionProps = SpeedDialActionButtonAttributes & {
  /** Visible and accessible label for the action. */
  label: string;
  /** Icon or compact content rendered inside the action button. */
  icon: Snippet;
  /** Called when the action is activated. The SpeedDial closes afterward. */
  onclick?: (event: MouseEvent) => void;
  /** Disables the action and removes it from roving keyboard navigation. */
  disabled?: boolean;
  /**
   * Placement of the visible label relative to the action button.
   * @default "auto"
   */
  labelPlacement?: SpeedDialActionLabelPlacement;
  /** Custom class merged with `.cinder-speed-dial-action`. */
  class?: string;
};

/** Schema-facing props for SpeedDialAction. */
export interface SpeedDialActionSchemaProps {
  /** Visible and accessible label for the action. */
  label: string;
  /**
   * Disables the action and removes it from roving keyboard navigation.
   * @default false
   */
  disabled?: boolean;
  /**
   * Placement of the visible label relative to the action button.
   * @default "auto"
   */
  labelPlacement?: SpeedDialActionLabelPlacement;
  /** Custom class merged with `.cinder-speed-dial-action`. */
  class?: string;
}
