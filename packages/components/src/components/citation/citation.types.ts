import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the Citation component. */
export type CitationProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /** Custom class merged with `.cinder-citation`. */
  class?: string;
  sources: CitationSource[];
  label?: string;
  children?: Snippet;
};

export type CitationSource = { label: string; url?: string; detail?: string };
