<script lang="ts" module>
  export const title = 'Controlled with bind:open';
  export const description = 'An external control drives open state via two-way binding.';
</script>

<script lang="ts">
  import { Collapsible } from 'cinder/collapsible';

  let open = $state(false);
</script>

<button type="button" onclick={() => (open = !open)}>
  {open ? 'Hide' : 'Show'} from outside
</button>

<Collapsible bind:open trigger="Controlled panel">
  <p>This panel's open state is shared with the external button above.</p>
</Collapsible>
