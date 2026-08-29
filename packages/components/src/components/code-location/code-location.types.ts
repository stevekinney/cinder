import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the CodeLocation component. */
export type CodeLocationProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Custom class merged with `.cinder-code-location`. */
  class?: string;
  file: string;
  line?: number;
  column?: number;
  children?: Snippet;
};
