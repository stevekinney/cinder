<script lang="ts" module>
  export const title = 'Basic toggle';
  export const description =
    'Switch using the WAI-ARIA switch pattern (aria-checked reflects state).';
</script>

<script lang="ts">
  import { Toggle } from '@lostgradient/cinder/toggle';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-email-notifications`);

  let emailNotifications = $state(false);
</script>

<Toggle id={fieldId} bind:checked={emailNotifications} label="Email notifications" />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  {emailNotifications ? 'Notifications enabled' : 'Notifications disabled'}
</p>
