import type { HTMLAttributes } from 'svelte/elements';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Current page number (1-indexed). Bindable. */
  currentPage: number;
  /** Total number of pages. Omit when only previous/next availability is known. */
  totalPages?: number;
  /** Whether a previous page is available when totalPages is unknown. Defaults to currentPage > 1. */
  hasPreviousPage?: boolean;
  /** Whether a next page is available when totalPages is unknown. Defaults to false. @default false */
  hasNextPage?: boolean;
  /** Optional total record count; formatted with formatNumber when provided. */
  totalCount?: number;
  /** Custom class merged with `.cinder-pagination`. */
  class?: string;
};
