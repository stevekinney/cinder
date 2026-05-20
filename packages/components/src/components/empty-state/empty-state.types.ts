import type { Snippet } from 'svelte';
export type EmptyStateProps = {
  title: string;
  description?: string;
  class?: string;
  icon?: Snippet;
  action?: Snippet;
};
