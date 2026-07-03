import type { HTMLAttributes } from 'svelte/elements';

export type SparkbarSize = 'sm' | 'md' | 'lg';
export type SparkbarVariant = 'accent' | 'success' | 'warning';

/** Props for the Sparkbar component. */
export type SparkbarProps = HTMLAttributes<HTMLDivElement> & {
  /** Current bounded value. */
  value: number;
  /** Upper bound for the range. Defaults to `1` for fractional values. */
  max?: number;
  /** Visible label for the measured row. */
  label: string;
  /** Optional trailing value such as a cost, token count, or percentage. */
  trailing?: string;
  /** Track thickness and text scale. Default `md`. */
  size?: SparkbarSize;
  /** Fill color intent. Default `accent`. */
  variant?: SparkbarVariant;
  /** Accessible name override. Defaults to `${label}, ${percentage}%`. */
  ariaLabel?: string;
  /** Custom class merged with `.cinder-sparkbar`. */
  class?: string;
};
