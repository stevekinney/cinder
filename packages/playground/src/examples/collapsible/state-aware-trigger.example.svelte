<script lang="ts" module>
  export const title = 'State-aware trigger label';
  export const description =
    'A snippet trigger receives { open, disabled } so the label can react to state.';
</script>

<script lang="ts">
  import { Collapsible } from 'cinder/collapsible';
</script>

<Collapsible>
  {#snippet trigger({ open })}
    {open ? 'Hide advanced options' : 'Show advanced options'}
  {/snippet}
  <p>Advanced configuration lives here.</p>
</Collapsible>
