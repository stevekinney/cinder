<script lang="ts" module>
  export const title = 'Subscription badge states';
  export const description =
    'All six billing lifecycle states, each with a distinct icon, label, and tone.';
</script>

<script lang="ts">
  import { SubscriptionBadge } from '@lostgradient/cinder/subscription-badge';
</script>

<div class="example-preview-row">
  <SubscriptionBadge state="active" />
  <SubscriptionBadge state="trialing" />
  <SubscriptionBadge state="past-due" />
  <SubscriptionBadge state="canceled" />
  <SubscriptionBadge state="expired" />
  <SubscriptionBadge state="refunded" />
</div>
