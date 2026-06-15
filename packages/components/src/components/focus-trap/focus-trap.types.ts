import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { FocusTargetInput, FocusTrapOptions } from './focus-trap.utilities.svelte.ts';

export type FocusTrapProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  children: Snippet;
  active?: boolean;
  restoreFocus?: boolean;
  initialFocus?: Exclude<FocusTargetInput, Function>;
  fallbackFocus?: Exclude<FocusTargetInput, Function>;
  class?: string;
};

export interface FocusTrapSchemaProps {
  /** When true (default), Tab key navigation is constrained within the trap container. Set to false to temporarily suspend trapping without unmounting. */
  active?: boolean;
  /** When true (default), returns focus to the previously focused element when the trap is deactivated or unmounted. */
  restoreFocus?: boolean;
  /** CSS selector for the element that should receive focus when the trap activates. Falls back to `fallbackFocus` when the selector matches nothing. */
  initialFocus?: string | null;
  /** CSS selector for the element that receives focus when `initialFocus` is unset or unresolvable. Defaults to the trap container itself. */
  fallbackFocus?: string | null;
  /** Additional class applied to the focus-trap wrapper element. */
  class?: string;
}

export type { FocusTrapOptions };
