<!--
  Test-only harness pinning the unbound `open` contract: `open={...}` seeds the
  initial state, and parent writes can drive panel visibility through `open={...}`.
  Not a public component.
-->
<script lang="ts">
  import Collapsible from './collapsible.svelte';

  let open = $state(false);
</script>

<button type="button" data-testid="parent-open" onclick={() => (open = true)}> parent open </button>
<button type="button" data-testid="parent-close" onclick={() => (open = false)}>
  parent close
</button>

<Collapsible {open} trigger="Harness panel">
  <p>panel body</p>
</Collapsible>
