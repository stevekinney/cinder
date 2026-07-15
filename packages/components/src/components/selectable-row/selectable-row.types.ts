import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

export type SelectableRowDensity = 'comfortable' | 'condensed';
export type SelectableRowCurrentValue = 'page' | 'step' | 'location' | 'date' | 'time' | 'true';

type SelectableRowSharedProps = {
  /** Density token surfaced as `data-cinder-density`. @default "comfortable" */
  density?: SelectableRowDensity;
  /** Whether the primary action represents the selected or current row. @default false */
  selected?: boolean;
  /** Leading visual such as an icon, avatar, marker, or status dot. */
  leading?: Snippet;
  /** Primary row label. Required so the native action has visible text and an accessible name. */
  title: Snippet;
  /** Secondary description below the title. */
  description?: Snippet;
  /** Tertiary metadata such as a timestamp, status, or compact badge. */
  meta?: Snippet;
  /** Independent controls rendered as siblings after the primary action. */
  trailingActions?: Snippet;
  /** Additional classes merged with `.cinder-selectable-row`. */
  class?: string;
  /** Inline style string applied to the `.cinder-selectable-row` root. */
  style?: string;
};

type SelectableRowButtonProps = SelectableRowSharedProps &
  Omit<
    HTMLButtonAttributes,
    'aria-current' | 'aria-pressed' | 'class' | 'href' | 'style' | 'title' | 'type'
  > & {
    href?: undefined;
    /** Called when the native primary button activates. Optional for submit and reset buttons. */
    onclick?: (event: MouseEvent) => void;
    /** Native button type. @default "button" */
    type?: 'button' | 'submit' | 'reset';
    currentValue?: never;
  };

type SelectableRowLinkProps = SelectableRowSharedProps &
  Omit<
    HTMLAnchorAttributes,
    'aria-current' | 'aria-pressed' | 'class' | 'href' | 'rel' | 'style' | 'target' | 'title'
  > & {
    /** Destination that renders the primary action as a native anchor. */
    href: string;
    /** Browsing context for the primary anchor. `_blank` merges `noopener noreferrer` into `rel`. */
    target?: HTMLAnchorAttributes['target'];
    /** `rel` forwarded to the primary anchor and de-duplicated case-insensitively; `noopener noreferrer` is merged when `target="_blank"`. */
    rel?: HTMLAnchorAttributes['rel'];
    /** `aria-current` value emitted when the linked row is selected. @default "page" */
    currentValue?: SelectableRowCurrentValue;
    type?: never;
  };

/** Props for SelectableRow. Pass `href` for a link or `onclick` for a button. */
export type SelectableRowProps = SelectableRowButtonProps | SelectableRowLinkProps;

/** Cinder-specific props used by the schema generator. */
export interface SelectableRowSchemaProps {
  /** Density token surfaced as `data-cinder-density`. @default "comfortable" */
  density?: SelectableRowDensity;
  /** Whether the primary action represents the selected or current row. @default false */
  selected?: boolean;
  /** Destination that renders the primary action as a native anchor. */
  href?: string;
  /** Browsing context for the primary anchor. `_blank` merges `noopener noreferrer` into `rel`. */
  target?: HTMLAnchorAttributes['target'];
  /** `rel` forwarded to the primary anchor and de-duplicated case-insensitively; `noopener noreferrer` is merged when `target="_blank"`. */
  rel?: HTMLAnchorAttributes['rel'];
  /** `aria-current` value emitted when a linked row is selected. @default "page" */
  currentValue?: SelectableRowCurrentValue;
  /** Native button type. @default "button" */
  type?: 'button' | 'submit' | 'reset';
  /** Leading visual such as an icon, avatar, marker, or status dot. */
  leading?: Snippet;
  /** Primary row label. Required. */
  title: Snippet;
  /** Secondary description below the title. */
  description?: Snippet;
  /** Tertiary metadata such as a timestamp, status, or compact badge. */
  meta?: Snippet;
  /** Independent controls rendered as siblings after the primary action. */
  trailingActions?: Snippet;
  /** Additional classes merged with `.cinder-selectable-row`. */
  class?: string;
  /** Inline style string applied to the `.cinder-selectable-row` root. */
  style?: string;
}
