import type { Snippet } from 'svelte';
/**
 * Props for the CheckboxGroup component.
 *
 * Wraps a set of independent checkboxes in a `<fieldset>` + `<legend>`
 * structure for semantic grouping. Unlike RadioGroup, this component does
 * NOT own a shared `value` or `name` — each child `<Checkbox>` owns its
 * own name and checked state. Native `<fieldset disabled>` propagation
 * handles the disabled cascade without any Svelte context.
 */
export type CheckboxGroupProps = {
  /**
   * Visible group caption. Rendered as a `<legend>` inside the `<fieldset>`.
   * Named `label` for consistency with every other form control — the element
   * is a `<legend>` because the group is a fieldset.
   */
  label?: string;
  /** Helper text below the group; wired via `aria-describedby` on the fieldset. */
  description?: string;
  /**
   * Group-level validation message. Rendered as a polite live region and
   * referenced by the fieldset's `aria-describedby`. Also sets
   * `aria-invalid="true"` on the fieldset itself as a supplementary signal.
   *
   * Note: fieldset-level `aria-describedby` is not reliably re-announced as
   * focus moves between descendants. This is best-effort supplemental context
   * — if a specific control must announce as invalid on focus, pass `error`
   * to that `<Checkbox>` directly.
   */
  error?: string;
  /**
   * Disables every native form control inside via the fieldset's built-in
   * cascade. Renders as the native `disabled` attribute on `<fieldset>`.
   */
  disabled?: boolean;
  /**
   * Marks the group required: sets `aria-required="true"` and
   * `data-cinder-required` on the fieldset and renders the required asterisk in
   * the legend.
   *
   * It does NOT set `required` on any child `<input>` and does NOT enforce
   * native constraint validation. Per-control `required` must be set on the
   * individual `<Checkbox>`.
   */
  required?: boolean;
  /**
   * Layout variant. `'default'` is a stacked column. `'card'` styles each
   * direct child `.cinder-checkbox-field` as a bordered card row.
   *
   * Always emitted as `data-variant` on the fieldset. Card variant assumes
   * each direct child of the items container is a single `<Checkbox>`.
   */
  variant?: 'default' | 'card';
  /** Additional class names merged with `.cinder-checkbox-group`. */
  class?: string;
  /** Checkbox children. */
  children: Snippet;
};
