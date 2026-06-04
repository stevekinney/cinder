<script lang="ts" module>
  export const title = 'Dismissible alert';
  export const description = 'An alert with a close button that fires onDismiss.';
</script>

<script lang="ts">
  import { Alert } from '@lostgradient/cinder/alert';
  let dismissed = $state(false);
</script>

{#if !dismissed}
  <Alert variant="info" dismissible onDismiss={() => (dismissed = true)}>
    You have 3 unread notifications.
  </Alert>
{:else}
  <p style="color: var(--cinder-text-muted); font-style: italic;">Alert dismissed.</p>
{/if}
