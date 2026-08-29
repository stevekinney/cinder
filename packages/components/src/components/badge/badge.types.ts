import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Visual style of the badge. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Size of the badge. */
export type BadgeSize = 'xs' | 'sm' | 'md';
export type BadgeSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Billing lifecycle states that Badge can render as an opinionated preset. */
export type BadgeSubscriptionState =
  | 'active'
  | 'trialing'
  | 'past-due'
  | 'canceled'
  | 'expired'
  | 'refunded';

/** Props for the Badge component. */
export type BadgeProps =
  | (HTMLAttributes<HTMLSpanElement> & {
      variant?: BadgeVariant;
      size?: BadgeSize;
      /** Render the badge label in a monospace font. */
      monospace?: boolean;
      class?: string;
      /** Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label. */
      subscriptionState: BadgeSubscriptionState;
      severity?: BadgeSeverity;
      /** Required badge content unless subscriptionState is provided; optional content override for the subscription preset label. */
      children?: Snippet;
    })
  | (HTMLAttributes<HTMLSpanElement> & {
      variant?: BadgeVariant;
      size?: BadgeSize;
      /** Render the badge label in a monospace font. */
      monospace?: boolean;
      class?: string;
      subscriptionState?: undefined;
      severity?: BadgeSeverity;
      /**
       * Badge content — intentionally required. A badge without content is
       * semantically meaningless.
       */
      children: Snippet;
    });

/** Cinder-specific props for the Badge component, used by the schema generator. */
export interface BadgeSchemaProps {
  /**
   * Visual style.
   * @default "neutral"
   */
  variant?: BadgeVariant;
  /**
   * Size of the badge.
   * @default "md"
   */
  size?: BadgeSize;
  /**
   * Render the badge label in a monospace font. Useful for version strings, error codes, or other technical labels.
   * @default false
   */
  monospace?: boolean;
  /** Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label. */
  subscriptionState?: BadgeSubscriptionState;
  /** Ordered severity preset; critical uses the dedicated critical token. */
  severity?: BadgeSeverity;
  /** Custom class merged with `.cinder-badge`. */
  class?: string;
}
