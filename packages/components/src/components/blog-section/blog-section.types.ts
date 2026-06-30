import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type BlogSectionPost = {
  /** Post title text. */
  title: string;
  /** Summary/excerpt text. */
  excerpt: string;
  /** URL to the full article. */
  href: string;
  /** Optional category label. */
  category?: string;
  /** Optional thumbnail image source. */
  imageSrc?: string;
  /** Optional publish date string. */
  publishedAt?: string;
  /** Author display name. */
  authorName: string;
  /** Optional author role/title text. */
  authorRole?: string;
  /** Optional author avatar image source. */
  authorAvatarSrc?: string;
};

/** Props for the BlogSection component. */
export type BlogSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Posts to render in the section. */
  posts: BlogSectionPost[];
  /** Grid column count. @default 3 */
  columns?: 1 | 2 | 3;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-blog-section`. */
  class?: string;
};

export interface BlogSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Posts to render in the section. */
  posts: BlogSectionPost[];
  /** Grid column count. @default 3 */
  columns?: 1 | 2 | 3;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-blog-section`. */
  class?: string;
}
