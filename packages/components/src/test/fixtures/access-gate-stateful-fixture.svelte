<script lang="ts">
  import AccessGate from '../../components/access-gate/access-gate.svelte';

  let granted = $state(false);
  let descriptionId = $state('initial-hint');
</script>

<button type="button" onclick={() => (descriptionId = 'updated-hint')}>
  Update child description
</button>
<button type="button" onclick={() => (granted = true)}>Grant scope</button>

<span id="initial-hint">Initial hint</span>
<span id="updated-hint">Updated hint</span>

<AccessGate {granted} reason="Requires scope: workflows:cancel">
  <button type="button" aria-describedby={descriptionId}>Stateful cancel</button>
</AccessGate>
