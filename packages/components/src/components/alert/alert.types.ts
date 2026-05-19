import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  class?: string;
  children: Snippet;
  icon?: Snippet;
};

/**
 * Cinder-specific props for the Alert component, used by the schema generator.
 * Excludes the inherited HTML attribute surface that consumers can spread via
 * `...rest` — those are documented in the underlying element's MDN reference.
 */
export interface AlertSchemaProps {
  /**
   * Visual style.
   * @default "info"
   */
  variant?: AlertVariant;
  /**
   * Allow the alert to be dismissed.
   * @default false
   */
  dismissible?: boolean;
  /** Custom class merged with `.cinder-alert`. */
  class?: string;
}
