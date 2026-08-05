import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

export type CallToActionSectionAlign = 'start' | 'center';
export type CallToActionSectionTone = 'default' | 'accent';

/** Props for the CallToActionSection component. */
export type CallToActionSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
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
  align?: CallToActionSectionAlign;
  /** Visual tone. @default "default" */
  tone?: CallToActionSectionTone;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Optional supplemental content below action buttons. */
  children?: Snippet;
  /** Custom class merged with `.cinder-call-to-action-section`. */
  class?: string;
};

/**
 * Cinder-specific props for CallToActionSection, used by the schema generator.
 *
 * Rule: the schema surface includes every public prop; inexpressible ones
 * (callbacks, snippets) are surfaced via `unsupportedProps`, never omitted.
 */
export interface CallToActionSectionSchemaProps {
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
  align?: CallToActionSectionAlign;
  /** Visual tone. @default "default" */
  tone?: CallToActionSectionTone;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-call-to-action-section`. */
  class?: string;
  /** Primary action click callback. */
  onPrimaryClick?: () => void;
  /** Secondary action click callback. */
  onSecondaryClick?: () => void;
  /** Optional supplemental content below action buttons. */
  children?: Snippet;
}
