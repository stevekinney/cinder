import type { HTMLInputAttributes } from 'svelte/elements';
/**
 * Props for the Checkbox component.
 *
 * Backed by a native `<input type="checkbox">` so it participates in form
 * submission and reset without extra wiring. The component owns the
 * label/description/error wrapper but delegates state, `name`, `value`,
 * and `disabled` semantics to the native element.
 *
 * `indeterminate` is a DOM property, not an attribute — Svelte's effect
 * sets it imperatively each time the prop changes, then clears it once
 * the user toggles `checked`.
 */
export type CheckboxProps = HTMLInputAttributes & {
  /**
   * Unique identifier for label association and ARIA wiring. Optional: when omitted,
   * a stable id is generated via `$props.id()` (or inherited from a FormField context),
   * matching Input/Autocomplete. Provide it when you need a known id to reference.
   */
  id?: string;
  /** Bound checked state. */
  checked?: boolean;
  /** Intercept a proposed checked state before the bindable value is written. Return a replacement value to transform it. */
  onValueChange?: (next: boolean) => boolean | void;
  /** Bound indeterminate state. Mutually exclusive with `checked` visually. */
  indeterminate?: boolean;
  /** Visible label rendered in a `<label>` element associated via `for`. */
  label?: string;
  /** Helper text displayed below the checkbox; wired via `aria-describedby`. */
  description?: string;
  /** Validation error message; sets `aria-invalid="true"` and `aria-describedby`. */
  error?: string;
  /** Disables the checkbox. */
  disabled?: boolean;
  /** Extra class names merged with the outer checkbox field wrapper. */
  fieldClass?: string;
  /** Extra class names merged with `.cinder-checkbox`. */
  class?: string;
};
