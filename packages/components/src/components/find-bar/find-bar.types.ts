import type { HTMLAttributes } from 'svelte/elements';
export type FindBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  query?: string;
  total?: number;
  match?: number;
  minQueryLength?: number;
  debounceMs?: number;
  onQueryChange?: (query: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  label?: string;
  class?: string;
};
