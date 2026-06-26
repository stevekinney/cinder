import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Visual style of the badge. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/** Size of the badge. */
export type BadgeSize = 'xs' | 'sm' | 'md';

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
      mono?: boolean;
      class?: string;
      /** Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label. */
      subscriptionState: BadgeSubscriptionState;
      /** Required badge content unless subscriptionState is provided; optional content override for the subscription preset label. */
      children?: Snippet;
    })
  | (HTMLAttributes<HTMLSpanElement> & {
      variant?: BadgeVariant;
      size?: BadgeSize;
      /** Render the badge label in a monospace font. */
      mono?: boolean;
      class?: string;
      subscriptionState?: undefined;
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
  mono?: boolean;
  /** Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label. */
  subscriptionState?: BadgeSubscriptionState;
  /** Custom class merged with `.cinder-badge`. */
  class?: string;
}
