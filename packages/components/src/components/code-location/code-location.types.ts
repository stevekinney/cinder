import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the CodeLocation component. */
export type CodeLocationProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /** Custom class merged with `.cinder-code-location`. */
  class?: string;
  file: string;
  line?: number;
  /** Rendered only when `line` is also provided. */
  column?: number;
  children?: Snippet;
};
