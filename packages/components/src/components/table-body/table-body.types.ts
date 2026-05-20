import type { Snippet } from 'svelte';
export type TableBodyProps = {
  /** Additional class names merged with `.cinder-table__body`. */
  class?: string;
  /** Row children. */
  children: Snippet;
};
