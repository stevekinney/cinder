import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Presentation mode for the access gate. */
export type AccessGateVariant = 'inline' | 'section';

/** Props for the AccessGate component. */
export type AccessGateProps = Omit<
  HTMLAttributes<HTMLElement>,
  'aria-describedby' | 'aria-labelledby' | 'children' | 'class' | 'role'
> & {
  /** Whether the consumer-authorized action or section is available. */
  granted: boolean;
  /**
   * Presentation mode.
   * @default "inline"
   */
  variant?: AccessGateVariant;
  /** Human-readable explanation shown to users and wired to assistive technology. */
  reason: string;
  /** Named scope, permission, or policy requirement shown in the section placeholder. */
  requirement?: string;
  /** Gated content. Rendered untouched when access is granted. */
  children?: Snippet;
  /** Custom class merged with the denied-state wrapper or section placeholder. */
  class?: string;
};

/** Cinder-specific props for AccessGate, used by the schema generator. */
export interface AccessGateSchemaProps {
  /** Whether the consumer-authorized action or section is available. */
  granted: boolean;
  /**
   * Presentation mode.
   * @default "inline"
   */
  variant?: AccessGateVariant;
  /** Human-readable explanation shown to users and wired to assistive technology. */
  reason: string;
  /** Named scope, permission, or policy requirement shown in the section placeholder. */
  requirement?: string;
  /** Gated content. Rendered untouched when access is granted. */
  children?: Snippet;
  /** Custom class merged with the denied-state wrapper or section placeholder. */
  class?: string;
}
