<script lang="ts" module>
  export const title = 'PricingSection';
  export const description =
    'PricingSection with multi-tier plans composed from PricingCard and plan selection callback.';
</script>

<script lang="ts">
  import { PricingSection } from '@lostgradient/cinder/pricing-section';

  const plans = [
    {
      name: 'Starter',
      price: '$0',
      features: ['3 projects', 'Community support'],
      cta: 'Start free',
    },
    {
      name: 'Pro',
      price: '$49 / month',
      features: ['Unlimited projects', 'Priority support', 'Team roles'],
      cta: 'Choose Pro',
      selected: true,
    },
    {
      name: 'Enterprise',
      price: 'Contact us',
      features: ['SSO + SCIM', 'Audit logs', 'Dedicated support'],
      cta: 'Talk to sales',
    },
  ];

  function handlePlanSelect(plan: (typeof plans)[number]) {
    // eslint-disable-next-line no-console
    console.log('selected plan', plan.name);
  }
</script>

<PricingSection
  title="Pricing for teams of every size"
  description="Start free, then scale with advanced collaboration and enterprise controls."
  {plans}
  onPlanSelect={handlePlanSelect}
/>
