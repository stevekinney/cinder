import type { Snippet } from 'svelte';
import type { ChoiceGridItemState } from '../choice-grid/choice-grid.types.ts';

export type { ChoiceGridItemState };

/**
 * Props for the `<ChoiceGridItem>` leaf component.
 */
export type ChoiceGridItemProps = {
  /**
   * The value this item represents. Used as the key for selection state,
   * roving tabindex registration, and ARIA attributes.
   */
  value: string;

  /**
   * Feedback state for assessment / quiz usage. Defaults to `'neutral'`.
   * Layout dimensions do NOT change across states (stable cell sizing guarantee).
   */
  state?: ChoiceGridItemState;

  /** When true this item cannot be selected or focused. */
  disabled?: boolean;

  /** Additional class names merged with `.cinder-choice-grid-item`. */
  class?: string;

  /** Item content — label text, an icon, or richer markup. */
  children: Snippet;
};
