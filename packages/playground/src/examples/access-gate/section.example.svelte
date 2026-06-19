<script lang="ts" module>
  export const title = 'Locked section';
  export const description = 'Replaces a protected region with a scope-required placeholder.';
</script>

<script lang="ts">
  import { AccessGate } from '@lostgradient/cinder/access-gate';
</script>

<AccessGate
  granted={false}
  variant="section"
  reason="Requires scope: storage:admin"
  requirement="storage:admin"
/>
