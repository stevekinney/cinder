import type { Snippet } from 'svelte';
export type FormFieldProps = {
  /** Required stable id — used for `<label for>`, description, error, and the child control's id via context. */
  id: string;
  /** Visible label text. Required — the primitive's whole purpose is label association. */
  label: string;
  /** Helper text rendered below the control; wired into `aria-describedby`. */
  description?: string;
  /** Validation error; sets `aria-invalid="true"` on opted-in controls via context. */
  error?: string;
  /** Renders a visual required marker and exposes `required: true` on the context. */
  required?: boolean;
  /** Propagated to opted-in controls via context. Does not style FormField itself. */
  disabled?: boolean;
  /** Additional class merged with `.cinder-form-field`. */
  class?: string;
  /** Control(s) rendered inside the field. */
  children: Snippet;
};
