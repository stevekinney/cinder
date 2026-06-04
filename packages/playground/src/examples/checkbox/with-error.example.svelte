<script lang="ts" module>
  export const title = 'Checkbox with error';
  export const description =
    'Validation error message surfaces via aria-invalid and aria-describedby.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Checkbox } from '@lostgradient/cinder/checkbox';
  let accepted = $state(false);
  let submitted = $state(false);
  const showError = $derived(submitted && !accepted);
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start;">
  {#if showError}
    <Checkbox
      id="checkbox-error-terms"
      label="I accept the terms"
      description="Required to create your account."
      bind:checked={accepted}
      error="You must accept the terms to continue."
    />
  {:else}
    <Checkbox
      id="checkbox-error-terms"
      label="I accept the terms"
      description="Required to create your account."
      bind:checked={accepted}
    />
  {/if}
  <Button variant="secondary" onclick={() => (submitted = true)}>Try to submit</Button>
</div>
