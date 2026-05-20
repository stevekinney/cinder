import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
export type DropdownItemVariant = 'default' | 'danger';
export type DropdownItemProps = Omit<HTMLButtonAttributes, 'class'> & {
  variant?: DropdownItemVariant;
  inset?: boolean;
  closeOnSelect?: boolean;
  class?: string;
  children?: Snippet;
};
