import type { HTMLAttributes } from 'svelte/elements';
export interface PolicyLockSchemaProps {
  id: string;
  reason: string;
  source?: string;
  scope?: string;
  class?: string;
}
export type PolicyLockProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'id'> & {
  id: string;
  reason: string;
  source?: string;
  scope?: string;
  class?: string;
};
