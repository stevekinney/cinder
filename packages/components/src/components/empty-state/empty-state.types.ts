import type { Snippet } from 'svelte';
export type EmptyStateProps = {
  title: string;
  description?: string;
  class?: string;
  /**
   * Heading level for the title element.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  icon?: Snippet;
  action?: Snippet;
};
