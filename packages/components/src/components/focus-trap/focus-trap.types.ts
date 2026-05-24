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
  active?: boolean;
  restoreFocus?: boolean;
  initialFocus?: string | null;
  fallbackFocus?: string | null;
  class?: string;
}

export type { FocusTrapOptions };
