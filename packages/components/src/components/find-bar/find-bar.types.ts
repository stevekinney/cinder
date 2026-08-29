import type { HTMLAttributes } from 'svelte/elements';
export type FindBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  value?: string;
  activeIndex?: number;
  matchCount?: number | null;
  minQueryLength?: number;
  debounceMs?: number;
  onQueryChange?: (query: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onDismiss?: () => void;
  label?: string;
  class?: string;
};
