import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type DropdownMenuProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Additional class names merged with the component's root class. */
  class?: string;
  children?: Snippet;
};
