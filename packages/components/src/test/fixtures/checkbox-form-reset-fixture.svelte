<script lang="ts">
  import Checkbox from '../../components/checkbox/checkbox.svelte';

  let checked = $state(false);
</script>

<form data-testid="form">
  <Checkbox id="accepted" bind:checked label="Accepted" />
  <button type="reset">Reset</button>
</form>

<output data-testid="checked">{String(checked)}</output>
