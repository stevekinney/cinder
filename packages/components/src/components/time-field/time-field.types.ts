import type { HTMLAttributes } from 'svelte/elements';

import type { HourCycle } from '../../_internal/time-parts.ts';

export type { HourCycle } from '../../_internal/time-parts.ts';

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
  /** BCP 47 locale used to resolve the default hour cycle. */
  locale?: string;
  /** Explicit hour cycle. Defaults from the locale, then `h12`. */
  hourCycle?: HourCycle;
  /** Time precision. Defaults to minute precision. */
  granularity?: TimeFieldGranularity;
  /** Optional timezone select values, such as `America/Denver` or `UTC`. */
  timezones?: readonly string[];
  /** Bindable selected timezone. Defaults to the first timezone when provided. */
  timezone?: string | undefined;
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
  locale?: string;
  hourCycle?: HourCycle;
  granularity?: TimeFieldGranularity;
  timezones?: readonly string[];
  timezone?: string | undefined;
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  name?: string;
  class?: string;
}
