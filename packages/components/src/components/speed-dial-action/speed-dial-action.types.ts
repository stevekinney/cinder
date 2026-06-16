import type { Snippet } from 'svelte';

import type { FloatingActionButtonProps } from '../floating-action-button/floating-action-button.types.ts';

/** Label placement for a SpeedDial.Action. */
export type SpeedDialActionLabelPlacement = 'auto' | 'start' | 'end' | 'none';

type FloatingActionButtonButtonProps = Extract<FloatingActionButtonProps, { href?: undefined }>;

type SpeedDialActionButtonAttributes = Omit<
  FloatingActionButtonButtonProps,
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
