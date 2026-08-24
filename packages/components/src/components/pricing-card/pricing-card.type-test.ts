/**
 * Compile-time regression tests for PricingCardProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * PricingCard exposes a custom `onPlanSelect` callback for CTA activation. The
 * lowercase native `onselect` handler must stay off the public surface so an
 * old handler cannot type-check while being forwarded to the root element
 * instead of the CTA.
 *
 * The CTA props are a discriminated union on `href` so at least one action is
 * always present: with no `href`, `onPlanSelect` is required (the button is
 * the only way to activate the CTA); with `href` set, `onPlanSelect` becomes
 * optional (and may coexist with it, e.g. for analytics). `target`/`rel` only
 * make sense in the `href` branch.
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

// @ts-expect-error - neither href nor onPlanSelect is provided, so the CTA has no way to activate
const _neitherHrefNorSelectRejected: PricingCardProps = { ...baseProps };

const _hrefWithoutOnPlanSelectAccepted: PricingCardProps = { ...baseProps, href: '/checkout' };

const _hrefWithOnPlanSelectAccepted: PricingCardProps = {
  ...baseProps,
  href: '/checkout',
  onPlanSelect: () => {},
  target: '_blank',
  rel: 'noopener noreferrer',
};

// @ts-expect-error - target/rel only make sense on the href (anchor) branch
const _targetWithoutHrefRejected: PricingCardProps = {
  ...baseProps,
  onPlanSelect: () => {},
  target: '_blank',
};

void _nativeSelectRejected;
void _customSelectAccepted;
void _neitherHrefNorSelectRejected;
void _hrefWithoutOnPlanSelectAccepted;
void _hrefWithOnPlanSelectAccepted;
void _targetWithoutHrefRejected;
