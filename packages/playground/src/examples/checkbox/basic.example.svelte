<script lang="ts" module>
  export const title = 'Basic checkbox';
  export const description = 'Unchecked and checked variants with associated labels.';
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder/checkbox';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let termsId = $derived(`${mountIdPrefix ?? uid}-terms`);
  let newsletterId = $derived(`${mountIdPrefix ?? uid}-newsletter`);

  let acceptTerms = $state(false);
  let subscribed = $state(true);
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Checkbox id={termsId} label="I accept the terms of service" bind:checked={acceptTerms} />
  <Checkbox id={newsletterId} label="Subscribe to the newsletter" bind:checked={subscribed} />
</div>
