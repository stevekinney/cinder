<script lang="ts" module>
  export const title = 'Radio group with error';
  export const description =
    'When validation fails, the group exposes an aria-describedby error message.';
</script>

<script lang="ts">
  import { Radio, RadioGroup } from '../../../../components/src/index.ts';

  let role = $state('');
  let submitted = $state(false);
  const showError = $derived(submitted && !role);
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start;">
  {#if showError}
    <RadioGroup
      name="with-error-role"
      legend="Role"
      description="Pick the role that best describes you."
      bind:value={role}
      error="Choose a role to continue."
    >
      <Radio id="with-error-role-engineer" value="engineer" label="Engineer" />
      <Radio id="with-error-role-designer" value="designer" label="Designer" />
      <Radio id="with-error-role-manager" value="manager" label="Manager" />
    </RadioGroup>
  {:else}
    <RadioGroup
      name="with-error-role"
      legend="Role"
      description="Pick the role that best describes you."
      bind:value={role}
    >
      <Radio id="with-error-role-engineer" value="engineer" label="Engineer" />
      <Radio id="with-error-role-designer" value="designer" label="Designer" />
      <Radio id="with-error-role-manager" value="manager" label="Manager" />
    </RadioGroup>
  {/if}

  <button
    type="button"
    style="padding: 0.4rem 0.75rem; border: 1px solid #c8c8c8; background: #fafafa; cursor: pointer;"
    onclick={() => (submitted = true)}
  >
    Try to submit
  </button>
</div>
