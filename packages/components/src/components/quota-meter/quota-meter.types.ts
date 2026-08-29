import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the QuotaMeter component. */
export type QuotaMeterProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Custom class merged with `.cinder-quota-meter`. */
  class?: string;
  used: number;
  limit?: number;
  resetsAt?: Date | string | number;
  unlimited?: boolean;
  label?: string;
  children?: Snippet;
};
