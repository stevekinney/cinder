<script lang="ts">
  import Input from '../../components/input/input.svelte';

  let value = $state('');
</script>

<form data-testid="form">
  <Input id="name" bind:value />
  <button type="reset">Reset</button>
</form>

<output data-testid="value">{value}</output>
