import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the QuotaMeter component. */
export type QuotaMeterProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Custom class merged with `.cinder-quota-meter`. */
  class?: string;
  used: number;
  limit?: number;
  resetsAt?: Date | string | number;
  /** BCP-47 locale used for the reset date. Defaults to LocaleProvider, then the runtime locale. */
  locale?: string;
  /** IANA time zone used for the reset date. @default "UTC" */
  timeZone?: string;
  unlimited?: boolean;
  label?: string;
  children?: Snippet;
};
