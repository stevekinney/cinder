<script lang="ts" module>
  export const title = 'Pricing tiers';
  export const description = 'Three plan tiles side by side with one pre-selected.';
</script>

<script lang="ts">
  import { PricingCard } from '@lostgradient/cinder/pricing-card';

  let selectedPlan = $state<'starter' | 'pro' | 'enterprise'>('pro');
</script>

<div
  style="display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--cinder-space-4); align-items: start;"
>
  <PricingCard
    name="Starter"
    price="Free"
    features={['3 projects', '1 GB storage', 'Community support']}
    cta="Get started"
    selected={selectedPlan === 'starter'}
    onselect={() => {
      selectedPlan = 'starter';
    }}
  />

  <PricingCard
    name="Pro"
    price="$9/mo"
    features={['Unlimited projects', '10 GB storage', 'Priority support', 'Custom domains']}
    cta="Choose Pro"
    selected={selectedPlan === 'pro'}
    onselect={() => {
      selectedPlan = 'pro';
    }}
  />

  <PricingCard
    name="Enterprise"
    price="$49/mo"
    features={[
      'Unlimited projects',
      '500 GB storage',
      'Dedicated support',
      'Custom domains',
      'SSO & audit logs',
    ]}
    cta="Contact sales"
    selected={selectedPlan === 'enterprise'}
    onselect={() => {
      selectedPlan = 'enterprise';
    }}
  />
</div>
