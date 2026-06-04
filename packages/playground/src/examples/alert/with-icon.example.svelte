<script lang="ts" module>
  export const title = 'Alert with icon';
  export const description = 'Custom icon slot alongside the alert message.';
</script>

<script lang="ts">
  import { Alert } from '@lostgradient/cinder/alert';
</script>

<Alert variant="success">
  {#snippet icon()}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  {/snippet}
  Deployment complete — all systems nominal.
</Alert>
