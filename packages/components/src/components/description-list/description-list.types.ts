import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
/** Layout variant for the description list. */
export type DescriptionListVariant = 'default' | 'striped' | 'two-column' | 'narrow';
export type DescriptionListItem = {
  /**
   * Stable identity for keyed rendering. Falls back to `term` when omitted.
   * Provide an explicit `id` when the list may contain duplicate terms.
   */
  id?: string;
  /** The label rendered inside `<dt>`. */
  term: string;
  /** The value rendered inside `<dd>`. */
  definition: string;
};
export type DescriptionListProps = Omit<HTMLAttributes<HTMLDListElement>, 'class'> & {
  items: DescriptionListItem[];
  /**
   * Controls the visual layout:
   * - `default`: stacked rows with visible terms.
   * - `striped`: alternating row backgrounds.
   * - `two-column`: term and definition share a row; collapses to stacked at narrow widths.
   * - `narrow`: `<dt>` is visually hidden via `.cinder-sr-only`. Only appropriate when
   *   surrounding context already labels the value. NOT a general compact mode.
   */
  variant?: DescriptionListVariant;
  class?: string;
  /**
   * Optional snippet rendered once per row. Receives the full `DescriptionListItem` so
   * consumers can build disambiguated `aria-label` strings (e.g. `aria-label="Edit ${item.term}"`).
   * Any interactive element in `actions` MUST set an unambiguous `aria-label`.
   */
  actions?: Snippet<[DescriptionListItem]>;
};
