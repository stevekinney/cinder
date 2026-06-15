import type { HTMLInputAttributes } from 'svelte/elements';
export type NumberInputProps = Omit<
  HTMLInputAttributes,
  | 'value'
  | 'defaultValue'
  | 'min'
  | 'max'
  | 'step'
  | 'name'
  | 'type'
  | 'oninput'
  | 'onchange'
  | 'onfocus'
  | 'onblur'
  | 'onkeydown'
> & {
  /** HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required. */
  id: string;
  /** Bindable current numeric value, or `null` when the field is empty. */
  value?: number | null;
  /** Initial value used when the component is uncontrolled or when the form is reset. */
  defaultValue?: number | null;
  /** Minimum permitted value; the stepper decrement button disables when this bound is reached. */
  min?: number;
  /** Maximum permitted value; the stepper increment button disables when this bound is reached. */
  max?: number;
  /** Amount added or subtracted per stepper click or arrow-key press. Default `1`. */
  step?: number;
  format?: Intl.NumberFormatOptions;
  /** BCP 47 locale tag used for number formatting and parsing. Defaults to `navigator.language`. */
  locale?: string;
  /** When true, disables the input and stepper buttons, matching the native `disabled` attribute. */
  disabled?: boolean;
  /** Marks the input as required for form validation, matching the native `required` attribute. */
  required?: boolean;
  /** Name used to identify this field's value in form data. */
  name?: string;
  /** Visible label text rendered above the input and linked via `for`/`id`. */
  label?: string;
  /** Helper text rendered below the input and associated via `aria-describedby`. */
  description?: string;
  /** Error message rendered below the input; also sets `aria-invalid` on the input. */
  error?: string;
  class?: string;
  onchange?: (value: number | null) => void;
};
