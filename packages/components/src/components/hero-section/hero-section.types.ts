import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

export type HeroSectionAlign = 'start' | 'center';
export type HeroSectionMediaPosition = 'start' | 'end';

/** Props for the HeroSection component. */
export type HeroSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Small uppercase intro label rendered above the title. */
  eyebrow?: string;
  /** Main marketing headline. */
  title: string;
  /** Supporting copy shown below the title. */
  description?: string;
  /** Text alignment for heading and body copy. @default "start" */
  align?: HeroSectionAlign;
  /** Position of the optional media panel on wide layouts. @default "end" */
  mediaPosition?: HeroSectionMediaPosition;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Optional CTA row, usually one or two Button components. */
  actions?: Snippet;
  /** Optional visual/media block (image, demo, illustration). */
  media?: Snippet;
  /** Optional extra content rendered below description/actions. */
  children?: Snippet;
  /** Custom class merged with `.cinder-hero-section`. */
  class?: string;
};

export interface HeroSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Small uppercase intro label rendered above the title. */
  eyebrow?: string;
  /** Main marketing headline. */
  title: string;
  /** Supporting copy shown below the title. */
  description?: string;
  /** Text alignment for heading and body copy. @default "start" */
  align?: HeroSectionAlign;
  /** Position of the optional media panel on wide layouts. @default "end" */
  mediaPosition?: HeroSectionMediaPosition;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-hero-section`. */
  class?: string;
}
