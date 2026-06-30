import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** Props for the NewsletterSection component. */
export type NewsletterSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Main section headline. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Input label text. @default "Email address" */
  emailLabel?: string;
  /** Placeholder shown in email input field. */
  emailPlaceholder?: string;
  /** Submit button label. @default "Subscribe" */
  submitLabel?: string;
  /** Callback fired after form submission with current email value. */
  onSubmit?: (email: string) => void;
  /** Optional helper/caveat text rendered under the form controls. */
  consentText?: string;
  /** Optional supplemental content below helper text. */
  children?: Snippet;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-newsletter-section`. */
  class?: string;
};

export interface NewsletterSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Main section headline. */
  title: string;
  /** Optional supporting copy. */
  description?: string;
  /** Input label text. @default "Email address" */
  emailLabel?: string;
  /** Placeholder shown in email input field. */
  emailPlaceholder?: string;
  /** Submit button label. @default "Subscribe" */
  submitLabel?: string;
  /** Optional helper/caveat text rendered under the form controls. */
  consentText?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-newsletter-section`. */
  class?: string;
}
