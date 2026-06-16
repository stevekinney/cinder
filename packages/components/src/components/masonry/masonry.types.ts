import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the Masonry component. */
export type MasonryProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** CSS column count value. */
  columns?: string;
  /** Gap between columns and between direct children. */
  gap?: string;
  /** Rendered HTML tag. */
  as?: string;
  /** Custom class merged with `.cinder-masonry`. */
  class?: string;
  /** Masonry contents. */
  children: Snippet;
};
