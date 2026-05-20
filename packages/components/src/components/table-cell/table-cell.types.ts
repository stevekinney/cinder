import type { Snippet } from 'svelte';
export type TableCellProps = {
  /** Visual alignment for numeric columns. */
  align?: 'left' | 'center' | 'right';
  /** Additional class names merged with `.cinder-table__cell`. */
  class?: string;
  /** Cell content. */
  children: Snippet;
};
