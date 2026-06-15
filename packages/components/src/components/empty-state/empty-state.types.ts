import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Primary heading text rendered as a heading element at the configured `headingLevel`. */
  title: string;
  /** Secondary descriptive text rendered as a paragraph below the title. */
  description?: string;
  /** Additional class merged onto the `.cinder-empty-state` root element. */
  class?: string;
  /**
   * Heading level for the title element.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  icon?: Snippet;
  action?: Snippet;
};
