import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type TabListProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Optional accessible name for the tablist. Sets `aria-label`. */
  label?: string;
  /** Reference to a heading or label element that names the tablist. */
  labelledBy?: string;
  /** Additional class names merged with `.cinder-tab-list`. */
  class?: string;
  /** Tab children. */
  children: Snippet;
};
