import type { HTMLInputAttributes } from 'svelte/elements';
/**
 * Props for the Radio component.
 *
 * Must be used inside a RadioGroup. The group owns `name`, `disabled`, and
 * the bound value; this component contributes `value`, the visible label,
 * and a unique `id` for label association.
 *
 * Per the WAI-ARIA radiogroup pattern, only the currently-checked radio
 * sits in the tab order (`tabindex=0`); all others are reachable only via
 * arrow keys (`tabindex=-1`). Native radio inputs implement this
 * automatically when they share a `name`, so we let the platform handle it.
 */
export type RadioProps = HTMLInputAttributes & {
  /** Unique identifier — required for label association. */
  id: string;
  /** The value submitted when this radio is selected. */
  value: string;
  /** Visible label rendered in a `<label>` element associated via `for`. */
  label: string;
  /** Helper text rendered as `<p id="{id}-description">`, wired via aria-describedby. */
  description?: string;
  /** Override the group's `disabled` for this single radio. */
  disabled?: boolean;
  /** Extra class names merged with `.cinder-radio`. */
  class?: string;
};
