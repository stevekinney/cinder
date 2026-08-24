import { defineConstraints } from '../../_internal/constraints.ts';

export default defineConstraints({
  component: 'pricing-card',
  summary:
    'PricingCard requires at least one CTA activation source (href or onPlanSelect), and target/rel only make sense once href is set.',
  rules: [
    {
      id: 'cta-activation-source',
      severity: 'error',
      description:
        'PricingCard must have at least one way to activate its CTA: href (renders an anchor) or onPlanSelect (renders a button). They are not mutually exclusive — both may be passed so href navigates while onPlanSelect still runs a side effect such as analytics tracking.',
      kind: 'anyOf',
      of: [
        { prop: 'href', nonEmpty: true },
        { prop: 'onPlanSelect', nonEmpty: true },
      ],
    },
    {
      id: 'anchor-only-attributes-need-href',
      severity: 'error',
      description:
        'target and rel only apply to the CTA anchor rendered when href is set — passing either without href has no element to attach to.',
      kind: 'requires',
      when: {
        anyOf: [
          { prop: 'target', exists: true },
          { prop: 'rel', exists: true },
        ],
      },
      of: [{ prop: 'href', nonEmpty: true }],
    },
  ],
  examples: {
    valid: [
      {
        title: 'Button CTA (no href)',
        code: '<PricingCard name="Pro" price="$9/mo" features={[\'Unlimited projects\']} callToActionLabel="Choose Pro" onPlanSelect={() => {}} />',
      },
      {
        title: 'Link CTA with target/rel',
        code: '<PricingCard name="Pro" price="$9/mo" features={[\'Unlimited projects\']} callToActionLabel="Continue" href="/checkout" target="_blank" rel="noopener noreferrer" />',
      },
      {
        title: 'Link CTA with onPlanSelect for analytics',
        code: '<PricingCard name="Pro" price="$9/mo" features={[\'Unlimited projects\']} callToActionLabel="Continue" href="/checkout" onPlanSelect={() => track()} />',
      },
    ],
    invalid: [
      {
        title: 'Neither href nor onPlanSelect',
        code: '<PricingCard name="Pro" price="$9/mo" features={[\'Unlimited projects\']} callToActionLabel="Choose Pro" />',
        violates: 'cta-activation-source',
      },
      {
        title: 'target without href',
        code: '<PricingCard name="Pro" price="$9/mo" features={[\'Unlimited projects\']} callToActionLabel="Choose Pro" onPlanSelect={() => {}} target="_blank" />',
        violates: 'anchor-only-attributes-need-href',
      },
    ],
  },
});
