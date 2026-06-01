<script lang="ts" module>
  export const title = 'Disabled trigger';
  export const description =
    'A disabled Collapsible cannot be toggled. The native disabled attribute removes the trigger from the tab order.';
</script>

<script lang="ts">
  import { Collapsible } from 'cinder/collapsible';
</script>

<Collapsible trigger="Locked section" disabled>
  <p>This content is inaccessible while the trigger is disabled.</p>
</Collapsible>
