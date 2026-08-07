/**
 * Compile-time regression tests for PricingCardProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * PricingCard exposes a custom `onPlanSelect` callback for CTA activation. The
 * lowercase native `onselect` handler must stay off the public surface so an
 * old handler cannot type-check while being forwarded to the root element
 * instead of the CTA.
 */
import type { PricingCardProps } from './pricing-card.types.ts';

const baseProps = {
  name: 'Pro',
  price: '$9/mo',
  features: ['Unlimited projects'],
  callToActionLabel: 'Choose Pro',
};

const _nativeSelectRejected: PricingCardProps = {
  ...baseProps,
  onPlanSelect: () => {},
  // @ts-expect-error - native onselect is excluded from PricingCardProps
  onselect: () => {},
};

const _customSelectAccepted: PricingCardProps = { ...baseProps, onPlanSelect: () => {} };

void _nativeSelectRejected;
void _customSelectAccepted;
