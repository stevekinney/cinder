import type { Snippet } from 'svelte';
export type DataListProps<T> = {
  items: T[];
  class?: string;
  children: Snippet<[T]>;
  empty?: Snippet;
};
