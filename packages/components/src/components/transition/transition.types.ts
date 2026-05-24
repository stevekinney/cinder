import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { TransitionConfig } from 'svelte/transition';

export type TransitionFunction<TransitionParameters = undefined> = (
  node: Element,
  parameters: TransitionParameters,
  options: { direction: 'in' | 'out' | 'both' },
) => TransitionConfig;

export type PresenceProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  present: boolean;
  children: Snippet;
  forceMount?: boolean;
  class?: string | undefined;
  onExitComplete?: () => void;
};

export type TransitionProps<TransitionParameters = undefined> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'class' | 'transition'
> & {
  show: boolean;
  children: Snippet;
  transition?: TransitionFunction<TransitionParameters>;
  transitionParameters?: TransitionParameters;
  class?: string;
};

export interface PresenceSchemaProps {
  present: boolean;
  forceMount?: boolean;
  class?: string;
}

export interface TransitionSchemaProps {
  show: boolean;
  class?: string;
}
