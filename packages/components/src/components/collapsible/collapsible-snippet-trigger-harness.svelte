<!--
  Test-only harness exercising a real `{#snippet}` trigger that reads the
  `{ open }` state, proving the label re-renders reactively on toggle.
  createRawSnippet renders once and cannot observe state changes, so a genuine
  template snippet is required to verify this contract. Not a public component.
-->
<script lang="ts">
  import Collapsible from './collapsible.svelte';
</script>

<Collapsible>
  {#snippet trigger({ open })}
    {open ? 'Hide' : 'Show'}
  {/snippet}
  <p>panel body</p>
</Collapsible>
