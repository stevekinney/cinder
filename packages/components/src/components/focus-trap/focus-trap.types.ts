import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { FocusTargetInput, FocusTrapOptions } from './focus-trap.utilities.svelte.ts';

export type FocusTrapProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  children: Snippet;
  active?: boolean;
  restoreFocus?: boolean;
  initialFocus?: Exclude<FocusTargetInput, Function>;
  fallbackFocus?: Exclude<FocusTargetInput, Function>;
  restoreFallback?: Exclude<FocusTargetInput, Function>;
  preferRestoreFallback?: boolean;
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
  /** CSS selector, resolved against the document, for the element that receives focus when the previously focused element cannot take it back — typically because it was removed from the DOM while the trap was open. Without it, focus falls to `<body>`. */
  restoreFallback?: string | null;
  /** When true, `restoreFallback` is tried before the previously focused element rather than only after it. For hosts that know the captured element is about to be removed but cannot prove it yet, such as a delete that awaits a server round trip. */
  preferRestoreFallback?: boolean;
  /** Additional class applied to the focus-trap wrapper element. */
  class?: string;
}

export type { FocusTrapOptions };
