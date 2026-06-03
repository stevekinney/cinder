import type { HTMLAttributes } from 'svelte/elements';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Current page number (1-indexed). Bindable. */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Optional total record count; formatted with formatNumber when provided. */
  totalCount?: number;
  /** Custom class merged with `.cinder-pagination`. */
  class?: string;
};
