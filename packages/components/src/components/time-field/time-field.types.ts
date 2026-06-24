import type { HTMLAttributes } from 'svelte/elements';

export type TimeFieldGranularity = 'minute' | 'second';

export type TimeFieldChange = {
  /** Canonical 24-hour time string (`HH:mm` or `HH:mm:ss`), or an empty string. */
  value: string;
  /** Selected timezone identifier when a timezone select is rendered. */
  timezone: string | undefined;
};

export type TimeFieldProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'onchange'
> & {
  /** Stable id used to associate the label, input, description, and error. Required. */
  id: string;
  /** Bindable canonical 24-hour time string (`HH:mm` or `HH:mm:ss`). */
  value?: string;
  /** Initial canonical time string used when the component is not controlled. */
  defaultValue?: string;
  /** Time precision. Defaults to minute precision. */
  granularity?: TimeFieldGranularity;
  /** Optional timezone select values, such as `America/Denver` or `UTC`. */
  timezones?: readonly string[];
  /** Bindable selected timezone. Defaults to the first timezone when provided. */
  timezone?: string | undefined;
  /** Name for the timezone value in native form submission. Defaults to `${name}-timezone`. */
  timezoneName?: string;
  /** Visible label text rendered above the input. */
  label?: string;
  /** Helper text rendered below the control. */
  description?: string;
  /** Validation error message. */
  error?: string;
  /** Disable all controls. */
  disabled?: boolean;
  /** Prevent editing while keeping the submitted value. */
  readonly?: boolean;
  /** Mark the time input as required. */
  required?: boolean;
  /** Name for form submission. */
  name?: string;
  /** Additional CSS classes applied to the root. */
  class?: string;
  /** Called when the user commits a time or timezone change. */
  onchange?: (detail: TimeFieldChange) => void;
};

export interface TimeFieldSchemaProps {
  id: string;
  value?: string;
  defaultValue?: string;
  granularity?: TimeFieldGranularity;
  timezones?: readonly string[];
  timezone?: string | undefined;
  timezoneName?: string;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  name?: string;
  class?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}
