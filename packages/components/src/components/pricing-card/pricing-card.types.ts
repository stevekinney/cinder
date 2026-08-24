import type { Snippet } from 'svelte';
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
  callToActionLabel: string;
  /**
   * Called when the CTA is activated. Optional when `href` is set, but not
   * mutually exclusive with it — pass both to navigate and run a side effect
   * such as analytics tracking (mirrors the cinder Button anchor branch).
   */
  onPlanSelect?: () => void;
  /**
   * When set, the CTA renders as an anchor (`<a href>`) instead of a
   * `<button>`. The outer card structure stays a fixed `<div>` — only the
   * inner CTA element swaps.
   */
  href?: string;
  /** `target` for the CTA anchor. Only applied when `href` is set. */
  target?: string;
  /** `rel` for the CTA anchor. Only applied when `href` is set. */
  rel?: string;
  /**
   * Optional footnote or caveat displayed beneath the features list.
   * Use for legal disclaimers, billing notes, or conditional terms.
   * Rendered in a visually subdued style to distinguish it from the main feature list.
   * Accepts plain text or a snippet (e.g. a terms link). Snippet content is
   * rendered inside a `<p>` — emit phrasing content only (text, inline
   * formatting, links), never block elements.
   */
  caveat?: string | Snippet;
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
  callToActionLabel: string;
  /**
   * When set, the CTA renders as an anchor (`<a href>`) instead of a
   * `<button>`. The outer card structure stays a fixed `<div>` — only the
   * inner CTA element swaps.
   */
  href?: string;
  /** `target` for the CTA anchor. Only applied when `href` is set. */
  target?: string;
  /** `rel` for the CTA anchor. Only applied when `href` is set. */
  rel?: string;
  /** Optional footnote or caveat beneath the features list; the runtime API also accepts a template-only snippet (e.g. a terms link). */
  caveat?: string;
  /**
   * Whether this card is the currently selected plan.
   * @default false
   */
  selected?: boolean;
  /** Custom class merged with `.cinder-pricing-card`. */
  class?: string;
}
