import type { HTMLAttributes } from 'svelte/elements';

/**
 * Billing lifecycle states for a subscription.
 *
 * Each value is stamped onto the root element as `data-cinder-state` and
 * maps to a Badge tone and an icon in `subscription-badge.svelte`. Color is
 * NOT the only differentiator — every state also carries a visible text label
 * and an icon so the state is conveyed even to users who cannot distinguish
 * colors (WCAG 1.4.1).
 */
export type SubscriptionState =
  | 'active'
  | 'trialing'
  | 'past-due'
  | 'canceled'
  | 'expired'
  | 'refunded';

/** Props for the SubscriptionBadge component. */
export type SubscriptionBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** The billing lifecycle state to display. */
  state: SubscriptionState;
  /** Extra classes forwarded to the underlying Badge. */
  class?: string;
};

/** Cinder-specific props for the SubscriptionBadge component, used by the schema generator. */
export interface SubscriptionBadgeSchemaProps {
  /**
   * The billing lifecycle state to display.
   * Determines the badge tone, icon, and label automatically.
   */
  state: SubscriptionState;
  /** Extra classes forwarded to the underlying Badge. */
  class?: string;
}
