import type { HTMLInputAttributes } from 'svelte/elements';

import type { HourCycle } from '../../_internal/time-parts.ts';

export type TimePickerProps = Omit<
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
  value?: string;
  defaultValue?: string;
  hourCycle?: HourCycle;
  locale?: string;
  seconds?: boolean;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  label?: string;
  description?: string;
  error?: string;
  class?: string;
  onchange?: (value: string) => void;
};
