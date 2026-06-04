<script lang="ts" module>
  export const title = 'Uncontrolled disclosure';
  export const description = 'Without bind:open the component owns its toggle state.';
</script>

<script lang="ts">
  import { Collapsible } from '@lostgradient/cinder/collapsible';
</script>

<Collapsible trigger="Shipping details">
  <p>Orders ship within two business days. Tracking is emailed on dispatch.</p>
</Collapsible>
