import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

export type CtaSectionAlign = 'start' | 'center';
export type CtaSectionTone = 'default' | 'accent';

/** Props for the CtaSection component. */
export type CtaSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Main CTA title. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Label for the primary call-to-action button. */
  primaryActionLabel: string;
  /** Optional label for a secondary action button. */
  secondaryActionLabel?: string;
  /** Primary action click callback. */
  onPrimaryClick?: () => void;
  /** Secondary action click callback. */
  onSecondaryClick?: () => void;
  /** Content alignment. @default "center" */
  align?: CtaSectionAlign;
  /** Visual tone. @default "default" */
  tone?: CtaSectionTone;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Optional supplemental content below action buttons. */
  children?: Snippet;
  /** Custom class merged with `.cinder-cta-section`. */
  class?: string;
};

export interface CtaSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Main CTA title. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Label for the primary call-to-action button. */
  primaryActionLabel: string;
  /** Optional label for a secondary action button. */
  secondaryActionLabel?: string;
  /** Content alignment. @default "center" */
  align?: CtaSectionAlign;
  /** Visual tone. @default "default" */
  tone?: CtaSectionTone;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-cta-section`. */
  class?: string;
}
