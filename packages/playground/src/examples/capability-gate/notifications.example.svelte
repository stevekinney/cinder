<script lang="ts" module>
  export const title = 'Notifications permission gate (banner)';
  export const description = 'A banner-style capability gate for browser notifications.';
</script>

<script lang="ts">
  import { CapabilityGate } from '@lostgradient/cinder/capability-gate';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <CapabilityGate
    feature="Notifications"
    state="permission-denied"
    variant="banner"
    fallbackAction="Enable in settings"
    fallbackHref="#"
    dismissAction="Dismiss"
  />
  <CapabilityGate feature="Offline storage" state="unsupported" variant="callout">
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted); margin: 0;">
      Your browser does not support offline storage. Some features may be limited.
    </p>
  </CapabilityGate>
</div>
