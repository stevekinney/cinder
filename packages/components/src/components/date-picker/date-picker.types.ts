import type { HTMLAttributes } from 'svelte/elements';

export type DatePickerGranularity = 'day' | 'hour' | 'minute' | 'second';

export type DatePickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
  /** Stable id for label/input/error wiring. */
  id: string;
  /** Controlled value as local ISO string. Bindable. */
  value?: string | undefined;
  /** Field label text. */
  label?: string;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Date-time precision. Defaults to day. */
  granularity?: DatePickerGranularity;
  /** Minimum allowed value (same format as `value`). */
  min?: string | undefined;
  /** Maximum allowed value (same format as `value`). */
  max?: string | undefined;
  /** Optional helper text. */
  description?: string;
  /** Optional validation error text. */
  error?: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Additional classes for the root. */
  class?: string;
  /** Called when the value changes. */
  onchange?: (value: string | undefined) => void;
};
