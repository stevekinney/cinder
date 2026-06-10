import type { HTMLAttributes } from 'svelte/elements';

/** Props for the PricingCard component. */
export type PricingCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'onselect'> & {
  /** Plan name displayed as the card heading. */
  name: string;
  /** Price string, e.g. "$9/mo" or "Free". Rendered verbatim — include any currency symbol and billing period. */
  price: string;
  /** List of feature strings to display. Rendered as a bulleted list. */
  features: string[];
  /** Label for the call-to-action button. */
  cta: string;
  /** Called when the CTA button is clicked. */
  onselect: () => void;
  /**
   * Optional footnote or caveat displayed beneath the features list.
   * Use for legal disclaimers, billing notes, or conditional terms.
   * Rendered in a visually subdued style to distinguish it from the main feature list.
   */
  caveat?: string;
  /**
   * Whether this card represents the currently selected plan.
   * Sets `data-cinder-selected` and `aria-current="true"` on the root element.
   */
  selected?: boolean;
  /** Merged with the root element's class list. */
  class?: string;
};

/** Cinder-specific props for the PricingCard component, used by the schema generator. */
export interface PricingCardSchemaProps {
  /** Plan name displayed as the card heading. */
  name: string;
  /** Price string, e.g. "$9/mo" or "Free". */
  price: string;
  /** Feature strings to display in the bulleted list. */
  features: string[];
  /** Label for the call-to-action button. */
  cta: string;
  /** Optional footnote or caveat beneath the features list. */
  caveat?: string;
  /**
   * Whether this card is the currently selected plan.
   * @default false
   */
  selected?: boolean;
  /** Custom class merged with `.cinder-pricing-card`. */
  class?: string;
}
