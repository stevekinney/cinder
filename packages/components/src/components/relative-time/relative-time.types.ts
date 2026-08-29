import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the RelativeTime component. */
export type RelativeTimeProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Custom class merged with `.cinder-relative-time`. */
  class?: string;
  date?: Date | string | number;
  locale?: string | string[];
  /** Recalculate the label on an interval. Set false to disable ticking. */
  tick?: boolean;
  children?: Snippet;
};
