import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type TestimonialSectionItem = {
  /** Quoted testimonial content. */
  quote: string;
  /** Person attribution name. */
  name: string;
  /** Optional role/job title. */
  role?: string;
  /** Optional avatar image source. */
  avatarSrc?: string;
  /** Optional company or team attribution. */
  company?: string;
};

export type TestimonialSectionLayout = 'single' | 'grid';

/** Props for the TestimonialSection component. */
export type TestimonialSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading. */
  title?: string;
  /** Optional heading description. */
  description?: string;
  /** Testimonials to render. */
  testimonials: TestimonialSectionItem[];
  /** Layout mode. @default "grid" */
  layout?: TestimonialSectionLayout;
  /** Columns used by grid layout. @default 3 */
  columns?: 2 | 3;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-testimonial-section`. */
  class?: string;
};

export interface TestimonialSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading. */
  title?: string;
  /** Optional heading description. */
  description?: string;
  /** Testimonials to render. */
  testimonials: TestimonialSectionItem[];
  /** Layout mode. @default "grid" */
  layout?: TestimonialSectionLayout;
  /** Columns used by grid layout. @default 3 */
  columns?: 2 | 3;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-testimonial-section`. */
  class?: string;
}
