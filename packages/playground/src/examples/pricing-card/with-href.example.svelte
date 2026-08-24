<script lang="ts" module>
  export const title = 'Linking to checkout';
  export const description =
    'When the CTA should navigate rather than run in-page logic, pass href (and optionally target/rel) and the CTA renders as an anchor. onPlanSelect is still called if provided, useful for analytics.';
</script>

<script lang="ts">
  import { PricingCard } from '@lostgradient/cinder/pricing-card';
</script>

<div style="max-inline-size: 22rem;">
  <PricingCard
    name="Pro"
    price="$29/mo"
    features={['Unlimited projects', '50 GB storage', 'Priority support']}
    callToActionLabel="Continue to checkout"
    href="/checkout?plan=pro"
    target="_blank"
    rel="noopener noreferrer"
    onPlanSelect={() => {
      // e.g. track an analytics event before navigation
    }}
  />
</div>
