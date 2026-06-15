import type { HTMLAttributes } from 'svelte/elements';
export type DropdownSeparatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  /** Additional class names merged with the component's root class. */
  class?: string;
};
