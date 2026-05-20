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
  id: string;
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  label?: string;
  description?: string;
  error?: string;
  class?: string;
  onchange?: (value: number | null) => void;
};
