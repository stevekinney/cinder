<script lang="ts">
  import AccessGate from '../../components/access-gate/access-gate.svelte';
</script>

<AccessGate granted={false} reason="Requires scope: workflows:cancel">
  <button type="button">Cancel workflow</button>
</AccessGate>
