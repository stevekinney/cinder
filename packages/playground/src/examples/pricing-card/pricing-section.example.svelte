<script lang="ts" module>
  export const title = 'Pricing section';
  export const description =
    'A full pricing-section recipe: Container frames a heading and supporting copy above a responsive grid of PricingCard plans with selection.';
</script>

<script lang="ts">
  import { Container } from '@lostgradient/cinder/container';
  import { PricingCard } from '@lostgradient/cinder/pricing-card';

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
    },
    {
      name: 'Enterprise',
      price: 'Contact us',
      features: ['SSO + SCIM', 'Audit logs', 'Dedicated support'],
      cta: 'Talk to sales',
    },
  ];

  let selectedPlan = $state('Pro');
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-2); max-inline-size: 60ch;">
        <h2 style="margin: 0;">Pricing for teams of every size</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          Start free, then scale with advanced collaboration and enterprise controls.
        </p>
      </header>

      <ul
        style="list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: var(--cinder-space-4); align-items: start;"
      >
        {#each plans as plan (plan.name)}
          <li>
            <PricingCard
              name={plan.name}
              price={plan.price}
              features={plan.features}
              cta={plan.cta}
              selected={selectedPlan === plan.name}
              onSelect={() => {
                selectedPlan = plan.name;
              }}
            />
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</section>
