<script lang="ts" module>
  export const title = 'Subscription badge in context';
  export const description =
    'SubscriptionBadge shown alongside plan details inside a Card, representing typical dashboard usage.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { SubscriptionBadge } from '@lostgradient/cinder/subscription-badge';

  const plans = [
    { name: 'Pro — Monthly', state: 'active' },
    { name: 'Team — Annual', state: 'trialing' },
    { name: 'Starter — Monthly', state: 'past-due' },
    { name: 'Enterprise', state: 'canceled' },
    { name: 'Starter — Legacy', state: 'expired' },
    { name: 'Hobby — Monthly', state: 'refunded' },
  ] as const;
</script>

<div class="example-preview-column">
  {#each plans as plan (plan.name)}
    <Card>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
        <span style="font-size: var(--cinder-text-sm); color: var(--cinder-text);">{plan.name}</span
        >
        <SubscriptionBadge state={plan.state} />
      </div>
    </Card>
  {/each}
</div>
