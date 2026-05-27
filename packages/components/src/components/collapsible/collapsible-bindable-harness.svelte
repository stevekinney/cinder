<!--
  Test-only harness proving Collapsible's `bind:open` two-way contract: an
  external readout reflects the bound state, and an external button mutates it.
  Not a public component — discovery ignores it (no matching directory name).
-->
<script lang="ts">
  import Collapsible from './collapsible.svelte';

  let open = $state(false);
</script>

<output data-testid="open-readout">{open ? 'open' : 'closed'}</output>
<button type="button" data-testid="external-toggle" onclick={() => (open = !open)}>
  external toggle
</button>

<Collapsible bind:open trigger="Harness panel">
  <p>panel body</p>
</Collapsible>
