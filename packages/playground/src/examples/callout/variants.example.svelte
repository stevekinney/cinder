<script lang="ts" module>
  export const title = 'Callout variants';
  export const description = 'All four semantic variant styles for inline callouts.';
</script>

<script lang="ts">
  import { Callout } from '@lostgradient/cinder/callout';
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Callout variant="info" title="Info">Keyboard shortcuts are available for most actions.</Callout>
  <Callout variant="success" title="Success">Your configuration has been validated.</Callout>
  <Callout variant="warning" title="Warning">This action cannot be undone once confirmed.</Callout>
  <Callout variant="danger" title="Danger"
    >Deleting this record will remove all associated data.</Callout
  >
</div>
