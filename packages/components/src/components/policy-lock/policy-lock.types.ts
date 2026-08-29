import type { HTMLAttributes } from 'svelte/elements';
export type PolicyLockProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'id'> & {
  id: string;
  reason: string;
  source?: string;
  scope?: string;
  class?: string;
};
