import type { HTMLAttributes } from 'svelte/elements';
export interface PolicyLockSchemaProps {
  /** Stable id for the lock explanation. */
  id: string;
  /** Required explanation of why the setting is managed. */
  reason: string;
  /** Name of the policy source, when the host can name it. */
  source?: string;
  /** Policy scope, rendered as a Badge when non-empty—`scope=""` renders nothing, the same as omitted (`{#if scope}`). */
  scope?: string;
  /** Additional class merged with the component's root class. */
  class?: string;
}
export type PolicyLockProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'id'> & {
  /** Stable id for the lock explanation. */
  id: string;
  /** Required explanation of why the setting is managed. */
  reason: string;
  /** Name of the policy source, when the host can name it. */
  source?: string;
  /** Policy scope, rendered as a Badge when non-empty—`scope=""` renders nothing, the same as omitted (`{#if scope}`). */
  scope?: string;
  /** Additional class merged with the component's root class. */
  class?: string;
};
