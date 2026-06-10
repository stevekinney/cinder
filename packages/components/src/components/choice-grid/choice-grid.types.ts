import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Feedback state for a choice grid item. Neutral means no feedback applied.
 * Correct / incorrect / pending communicate quiz or assessment results.
 */
export type ChoiceGridItemState = 'neutral' | 'correct' | 'incorrect' | 'pending';

/**
 * Column layout for the grid. 'responsive' uses auto-fill with a minimum cell
 * width. A number sets a fixed column count.
 */
export type ChoiceGridColumns = 'responsive' | 1 | 2 | 3 | 4;

/**
 * Shape of the context object provided to ChoiceGridItem children.
 *
 * All members are getter properties on the context object so reads remain
 * reactive inside `$derived` expressions in the children. Destructuring the
 * context breaks reactivity; always access via `context.field`.
 */
export type ChoiceGridContext = {
  /**
   * The currently selected value (single-select mode) or null when nothing
   * is selected. In multi-select mode this field is unused — children check
   * `isSelected` instead.
   */
  readonly value: string | null;

  /** True when the grid allows multiple simultaneous selections. */
  readonly multiple: boolean;

  /** True when ALL items are disabled (the grid-level disabled prop). */
  readonly disabled: boolean;

  /**
   * True when `candidate` is currently selected (works for both single- and
   * multi-select modes).
   */
  isSelected: (candidate: string) => boolean;

  /**
   * Select or toggle `candidate`. In single-select mode this sets the value;
   * in multi-select mode this toggles the candidate in the values set.
   */
  select: (candidate: string) => void;

  /**
   * Register an item element with the parent so the parent can drive roving
   * tabindex focus. `disabled` is tracked so disabled items are skipped by both
   * the roving-tabindex computation and arrow-key navigation.
   */
  register: (value: string, element: HTMLElement, disabled: boolean) => void;

  /** Update the tracked disabled state for an already-registered item. */
  setItemDisabled: (value: string, disabled: boolean) => void;

  /** Remove an item from the registry on unmount. */
  unregister: (value: string) => void;

  /**
   * Whether `candidate` should hold `tabindex="0"`. Must be called inside
   * a `$derived` to remain reactive.
   */
  isFocusable: (candidate: string) => boolean;

  /** Items forward `keydown` here for shared arrow-key navigation. */
  handleKeydown: (event: KeyboardEvent) => void;
};

/**
 * Props for the `<ChoiceGrid>` parent component.
 */
export type ChoiceGridProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'aria-label' | 'aria-labelledby'
> & {
  /**
   * The currently selected value (single-select mode). Bindable.
   * Pass `null` or omit to start with no selection.
   */
  value?: string | null;

  /**
   * Currently selected values (multi-select mode). Bindable. Only used when
   * `multiple` is `true` — set `multiple` explicitly to switch modes; binding
   * `values` alone does NOT enable multi-select.
   */
  values?: string[];

  /**
   * When true the grid allows multiple simultaneous selections and reads/writes
   * `values` instead of `value`. The ARIA role switches to `group` (items become
   * `checkbox`); single-select uses `radiogroup` (items become `radio`).
   */
  multiple?: boolean;

  /**
   * Column layout.
   * - `'responsive'` — `auto-fill` at a minimum cell width (default).
   * - `1 | 2 | 3 | 4` — fixed number of columns.
   */
  columns?: ChoiceGridColumns;

  /**
   * Minimum cell width for `columns="responsive"`. Accepts any CSS
   * `<length>` (e.g. `"12rem"`, `"200px"`). Default: `"10rem"`.
   */
  minColumnWidth?: string;

  /** Accessible label for the grid (required unless `ariaLabelledby` is set). */
  ariaLabel?: string;

  /** Id of an external element that labels this grid. */
  ariaLabelledby?: string;

  /** Disables all items in the grid. */
  disabled?: boolean;

  /** Additional class names merged with `.cinder-choice-grid`. */
  class?: string;

  /** `ChoiceGridItem` children. */
  children: Snippet;
};

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
