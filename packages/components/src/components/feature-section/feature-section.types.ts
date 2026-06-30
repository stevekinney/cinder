import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type FeatureSectionItem = {
  /** Feature heading text. */
  title: string;
  /** Supporting feature description. */
  description: string;
  /** Optional decorative icon text (emoji or short symbol). */
  icon?: string;
};

export type FeatureSectionLayout = 'grid' | 'split';
export type FeatureSectionMediaPosition = 'start' | 'end';

/** Props for the FeatureSection component. */
export type FeatureSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Section title rendered above the feature list. */
  title: string;
  /** Optional supporting intro copy for the section heading. */
  description?: string;
  /** Features to render. */
  items: FeatureSectionItem[];
  /** Section layout mode. @default "grid" */
  layout?: FeatureSectionLayout;
  /** Grid column count used by the `grid` layout. @default 3 */
  columns?: 2 | 3 | 4;
  /** Position of optional media in split layout. @default "end" */
  mediaPosition?: FeatureSectionMediaPosition;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Optional media content for split layout. */
  media?: Snippet;
  /** Optional content rendered under the heading before the features list. */
  children?: Snippet;
  /** Custom class merged with `.cinder-feature-section`. */
  class?: string;
};

export interface FeatureSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Section title rendered above the feature list. */
  title: string;
  /** Optional supporting intro copy for the section heading. */
  description?: string;
  /** Features to render. */
  items: FeatureSectionItem[];
  /** Section layout mode. @default "grid" */
  layout?: FeatureSectionLayout;
  /** Grid column count used by the `grid` layout. @default 3 */
  columns?: 2 | 3 | 4;
  /** Position of optional media in split layout. @default "end" */
  mediaPosition?: FeatureSectionMediaPosition;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-feature-section`. */
  class?: string;
}
