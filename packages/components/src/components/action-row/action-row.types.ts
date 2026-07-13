import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';

export type ActionRowDensity = 'comfortable' | 'condensed';
export type ActionRowSelectedState = 'pressed' | 'current';
export type ActionRowCurrentValue = 'page' | 'step' | 'location' | 'date' | 'time' | 'true';

export type ActionRowProps = Omit<
  HTMLButtonAttributes,
  'aria-current' | 'aria-pressed' | 'class' | 'title' | 'type'
> & {
  /**
   * Density token surfaced as `data-cinder-density`.
   * @default "comfortable"
   */
  density?: ActionRowDensity;
  /**
   * Whether the row is currently selected.
   * @default false
   */
  selected?: boolean;
  /**
   * Accessible state mapping for selected rows.
   * Use `pressed` for in-page selectable rows and `current` for navigation/current-item rows.
   * @default "pressed"
   */
  selectedState?: ActionRowSelectedState;
  /**
   * `aria-current` value used when `selectedState="current"` and `selected` is true.
   * @default "true"
   */
  currentValue?: ActionRowCurrentValue;
  /**
   * Native button type.
   * @default "button"
   */
  type?: 'button' | 'submit' | 'reset';
  /** Leading visual such as an icon, avatar, marker, or status dot. */
  leading?: Snippet;
  /** Primary row label. Required so the row has visible text and an accessible name. */
  title: Snippet;
  /** Secondary description below the title. */
  description?: Snippet;
  /** Tertiary metadata such as timestamp, status text, or a compact badge. */
  meta?: Snippet;
  /** Trailing region such as a timestamp, count, badge, chevron, or shortcut hint. */
  trailing?: Snippet;
  /** Additional classes merged with `.cinder-action-row`. */
  class?: string;
};

/** Schema generator surface for ActionRow — excludes native button attributes except supported styling hooks. */
export interface ActionRowSchemaProps {
  /**
   * Density token surfaced as `data-cinder-density`.
   * @default "comfortable"
   */
  density?: ActionRowDensity;
  /**
   * Whether the row is currently selected.
   * @default false
   */
  selected?: boolean;
  /**
   * Accessible state mapping for selected rows.
   * Use `pressed` for in-page selectable rows and `current` for navigation/current-item rows.
   * @default "pressed"
   */
  selectedState?: ActionRowSelectedState;
  /**
   * `aria-current` value used when `selectedState="current"` and `selected` is true.
   * @default "true"
   */
  currentValue?: ActionRowCurrentValue;
  /**
   * Native button type.
   * @default "button"
   */
  type?: 'button' | 'submit' | 'reset';
  /** Leading visual such as an icon, avatar, marker, or status dot. */
  leading?: Snippet;
  /** Primary row label. Required so the row has visible text and an accessible name. */
  title: Snippet;
  /** Secondary description below the title. */
  description?: Snippet;
  /** Tertiary metadata such as timestamp, status text, or a compact badge. */
  meta?: Snippet;
  /** Trailing region such as a timestamp, count, badge, chevron, or shortcut hint. */
  trailing?: Snippet;
  /** Additional classes merged with `.cinder-action-row`. */
  class?: string;
  /** Inline style string applied to the `.cinder-action-row` root. */
  style?: string;
}
