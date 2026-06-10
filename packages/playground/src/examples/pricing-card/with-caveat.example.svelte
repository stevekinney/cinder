<script lang="ts" module>
  export const title = 'With caveat';
  export const description =
    'A pricing card with a consumer-supplied caveat beneath the feature list, useful for legal disclaimers or billing notes.';
</script>

<script lang="ts">
  import { PricingCard } from '@lostgradient/cinder/pricing-card';
</script>

<div style="max-inline-size: 22rem;">
  <PricingCard
    name="Growth"
    price="$29/mo"
    features={['Unlimited projects', '50 GB storage', 'Email & chat support', 'Advanced analytics']}
    caveat="Billed annually. Monthly billing available at $35/mo."
    cta="Start free trial"
    onselect={() => {}}
  />
</div>
