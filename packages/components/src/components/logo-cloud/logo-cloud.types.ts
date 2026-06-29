import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type LogoCloudItem = {
  /** Brand or company name. Used as image alt text. */
  name: string;
  /** Logo image source URL. */
  src: string;
  /** Optional link destination for the logo. */
  href?: string;
};

/** Props for the LogoCloud component. */
export type LogoCloudProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional heading text for the logo cloud. */
  title?: string;
  /** Optional support text under heading. */
  description?: string;
  /** Logos to render in the cloud. */
  logos: LogoCloudItem[];
  /** Grid columns on wide screens. @default 5 */
  columns?: 3 | 4 | 5 | 6;
  /** Apply grayscale filter until hover. @default true */
  grayscale?: boolean;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-logo-cloud`. */
  class?: string;
};

export interface LogoCloudSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional heading text for the logo cloud. */
  title?: string;
  /** Optional support text under heading. */
  description?: string;
  /** Logos to render in the cloud. */
  logos: LogoCloudItem[];
  /** Grid columns on wide screens. @default 5 */
  columns?: 3 | 4 | 5 | 6;
  /** Apply grayscale filter until hover. @default true */
  grayscale?: boolean;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-logo-cloud`. */
  class?: string;
}
