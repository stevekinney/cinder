import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type ZoomPanViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  class?: string;
  children: Snippet;
  scale?: number;
  ariaLabel?: string;
  onTransformChange?: (transform: { scale: number; x: number; y: number }) => void;
};
