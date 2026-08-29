<script lang="ts" module>
  export const title = 'Notifications permission gate (banner)';
  export const description = 'A banner-style capability gate for browser notifications.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { CapabilityGate } from '@lostgradient/cinder/capability-gate';
  import { Link } from '@lostgradient/cinder/link';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <CapabilityGate feature="Notifications" state="permission-denied" variant="banner">
    {#snippet actions({ dismiss })}
      <Link href="#">Enable in settings</Link>
      <Button size="sm" variant="ghost" label="Dismiss" onclick={dismiss} />
    {/snippet}
  </CapabilityGate>
  <CapabilityGate feature="Location" state="permission-limited" variant="banner">
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted); margin: 0;">
      Approximate location is available. Grant precise access in system settings if needed.
    </p>
  </CapabilityGate>
  <CapabilityGate feature="Offline storage" state="unsupported" variant="callout">
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted); margin: 0;">
      Your browser does not support offline storage. Some features may be limited.
    </p>
  </CapabilityGate>
</div>
