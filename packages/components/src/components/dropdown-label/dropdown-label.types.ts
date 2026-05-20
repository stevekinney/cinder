import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type DropdownLabelProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: string;
  children?: Snippet;
};
