<script lang="ts" module>
  export const title = 'Basic toggle';
  export const description =
    'Switch using the WAI-ARIA switch pattern (aria-checked reflects state).';
</script>

<script lang="ts">
  import { Toggle } from '../../../../components/src/index.ts';

  let emailNotifications = $state(false);
</script>

<Toggle id="email-notifications" bind:checked={emailNotifications} label="Email notifications" />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  {emailNotifications ? 'Notifications enabled' : 'Notifications disabled'}
</p>
