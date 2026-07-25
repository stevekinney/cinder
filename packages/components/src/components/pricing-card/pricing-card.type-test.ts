/**
 * Compile-time regression tests for PricingCardProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * PricingCard exposes a custom `onSelect` callback for CTA activation. The
 * lowercase native `onselect` handler must stay off the public surface so an
 * old handler cannot type-check while being forwarded to the root element
 * instead of the CTA.
 */
import type { PricingCardProps } from './pricing-card.types.ts';

const baseProps = {
  name: 'Pro',
  price: '$9/mo',
  features: ['Unlimited projects'],
  cta: 'Choose Pro',
};

const _nativeSelectRejected: PricingCardProps = {
  ...baseProps,
  onSelect: () => {},
  // @ts-expect-error - native onselect is excluded from PricingCardProps
  onselect: () => {},
};

const _customSelectAccepted: PricingCardProps = { ...baseProps, onSelect: () => {} };

void _nativeSelectRejected;
void _customSelectAccepted;
