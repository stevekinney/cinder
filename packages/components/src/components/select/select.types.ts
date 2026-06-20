import type { HTMLSelectAttributes } from 'svelte/elements';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SelectProps<T extends string = string> = HTMLSelectAttributes & {
  /** Unique identifier — required for label association and ARIA wiring. */
  id: string;
  /** Bound selected value. `undefined` when nothing is selected. */
  value?: NoInfer<T>;
  /** Options to render as `<option>` children. The sole inference source for T. */
  options: readonly SelectOption<T>[];
  /** Visible label rendered in a `<label>` associated via `for`. */
  label?: string;
  /** Helper text rendered below the control; wired via `aria-describedby`. */
  description?: string | undefined;
  /** Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`. */
  error?: string | undefined;
  /** Marks the control required and sets the native `required` attribute. */
  required?: boolean;
  /** Disables the control. */
  disabled?: boolean;
  /** Extra class names merged with `.cinder-select-field`. */
  class?: string;
};
