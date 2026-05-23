import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

type DropdownGroupBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-labelledby' | 'class' | 'role'
> & {
  /** Additional class names merged onto the group root. */
  class?: string;
  /** DropdownLabel plus grouped DropdownItem rows. */
  children?: Snippet;
};

export type DropdownGroupProps = DropdownGroupBaseProps &
  ({ ariaLabel: string; labelledBy?: never } | { ariaLabel?: never; labelledBy: string });
