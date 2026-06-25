<script lang="ts">
  import { Checkbox } from '../../index.ts';

  let checked = $state(false);
  let indeterminate = $state(true);
</script>

<form data-testid="form">
  <Checkbox id="mixed" bind:checked bind:indeterminate label="Mixed" />
  <button type="reset">Reset</button>
</form>
<output data-testid="checked">{String(checked)}</output>
<output data-testid="indeterminate">{String(indeterminate)}</output>
