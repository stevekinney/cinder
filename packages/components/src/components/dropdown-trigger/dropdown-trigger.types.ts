import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
export type DropdownTriggerProps = Omit<HTMLButtonAttributes, 'class'> & {
  class?: string;
  /** Render the trailing disclosure caret. Defaults to true. */
  showCaret?: boolean;
  children?: Snippet;
};
