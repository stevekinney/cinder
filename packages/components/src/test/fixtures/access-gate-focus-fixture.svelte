<script lang="ts">
  import AccessGate from '../../components/access-gate/access-gate.svelte';

  let granted = $state(true);
</script>

<button type="button" onclick={() => (granted = false)}>Deny scope</button>

<AccessGate {granted} reason="Requires scope: workflows:cancel">
  <span role="button" tabindex="0">Focusable cancel</span>
</AccessGate>
