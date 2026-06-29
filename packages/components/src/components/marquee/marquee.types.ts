import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type MarqueeDirection = 'horizontal' | 'vertical';

/** Props for the Marquee component. */
export type MarqueeProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  /** Scroll direction for the looping track. @default "horizontal" */
  direction?: MarqueeDirection;
  /** Animation duration for one complete loop (valid CSS time). @default "24s" */
  duration?: string;
  /** Gap between repeated items (valid CSS length). @default "1.5rem" */
  gap?: string;
  /** Accessible region label for the marquee container. */
  label?: string;
  /** Pause animation while hovered (pointer-capable devices). @default true */
  pauseOnHover?: boolean;
  /** Pause animation while any child is focused. @default true */
  pauseOnFocus?: boolean;
  /** Custom class merged with `.cinder-marquee`. */
  class?: string;
  /** Rendered marquee content. */
  children: Snippet;
};

export interface MarqueeSchemaProps {
  /** Scroll direction for the looping track. @default "horizontal" */
  direction?: MarqueeDirection;
  /** Animation duration for one complete loop (valid CSS time). @default "24s" */
  duration?: string;
  /** Gap between repeated items (valid CSS length). @default "1.5rem" */
  gap?: string;
  /** Accessible region label for the marquee container. */
  label?: string;
  /** Pause animation while hovered (pointer-capable devices). @default true */
  pauseOnHover?: boolean;
  /** Pause animation while any child is focused. @default true */
  pauseOnFocus?: boolean;
  /** Custom class merged with `.cinder-marquee`. */
  class?: string;
}
