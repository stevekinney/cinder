import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type TableBodyProps = Omit<HTMLAttributes<HTMLTableSectionElement>, 'class' | 'children'> & {
  /** Additional class names merged with `.cinder-table__body`. */
  class?: string;
  /** Row children. */
  children: Snippet;
};
