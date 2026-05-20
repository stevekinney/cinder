import type { HTMLAttributes } from 'svelte/elements';
export type DropdownSeparatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: string;
};
