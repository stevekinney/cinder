import type { Snippet } from 'svelte';
import type { HTMLTdAttributes } from 'svelte/elements';

export type TableCellProps = Omit<HTMLTdAttributes, 'class' | 'align'> & {
  /** Visual alignment for numeric columns. */
  align?: 'left' | 'center' | 'right';
  /** Additional class names merged with `.cinder-table__cell`. */
  class?: string;
  /** Cell content. */
  children: Snippet;
};
