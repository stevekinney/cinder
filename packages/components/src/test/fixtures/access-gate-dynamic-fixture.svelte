<script lang="ts">
  import AccessGate from '../../components/access-gate/access-gate.svelte';

  let showDeniedAction = $state(false);
</script>

<button type="button" onclick={() => (showDeniedAction = true)}>Reveal denied action</button>

<AccessGate granted={false} reason="Requires scope: workflows:cancel">
  {#if showDeniedAction}
    <button type="button">Dynamic cancel</button>
  {/if}
</AccessGate>
