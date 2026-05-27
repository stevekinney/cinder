import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ContextMenuTriggerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: string;
  children: Snippet;
};
