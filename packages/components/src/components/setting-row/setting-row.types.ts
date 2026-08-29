import type { Snippet } from 'svelte';
import type { FormFieldManaged } from '../form-field/form-field.types.ts';
export type SettingRowProps = {
  id: string;
  label: string;
  description?: string;
  warning?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  managed?: FormFieldManaged;
  control: Snippet;
  disclosure?: Snippet;
  class?: string;
};
