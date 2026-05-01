<script lang="ts" module>
  export const title = 'Checkbox with error';
  export const description =
    'Validation error message surfaces via aria-invalid and aria-describedby.';
</script>

<script lang="ts">
  import { Checkbox } from '../../../../components/src/index.ts';

  let accepted = $state(false);
  let submitted = $state(false);
  const showError = $derived(submitted && !accepted);
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
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
  <button
    type="button"
    style="align-self: flex-start; padding: 0.4rem 0.75rem; border: 1px solid #c8c8c8; background: #fafafa; cursor: pointer;"
    onclick={() => (submitted = true)}
  >
    Try to submit
  </button>
</div>
