import type { HTMLSelectAttributes } from 'svelte/elements';
export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = HTMLSelectAttributes & {
  /** Unique identifier — required for label association and ARIA wiring. */
  id: string;
  /** Bound selected value. */
  value: string;
  /** Options to render as `<option>` children. */
  options: SelectOption[];
  /** Visible label rendered in a `<label>` associated via `for`. */
  label?: string;
  /** Helper text rendered below the control; wired via `aria-describedby`. */
  description?: string;
  /** Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`. */
  error?: string;
  /** Marks the control required and sets the native `required` attribute. */
  required?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Extra class names merged with `.cinder-select-field`. */
  class?: string;
};
