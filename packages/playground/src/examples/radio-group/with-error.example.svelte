<script lang="ts" module>
  export const title = 'Radio group with error';
  export const description =
    'When validation fails, the group exposes an aria-describedby error message.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { RadioGroup } from '@lostgradient/cinder/radio-group';
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
      <RadioGroup.Option id="with-error-role-engineer" value="engineer" label="Engineer" />
      <RadioGroup.Option id="with-error-role-designer" value="designer" label="Designer" />
      <RadioGroup.Option id="with-error-role-manager" value="manager" label="Manager" />
    </RadioGroup>
  {:else}
    <RadioGroup
      name="with-error-role"
      legend="Role"
      description="Pick the role that best describes you."
      bind:value={role}
    >
      <RadioGroup.Option id="with-error-role-engineer" value="engineer" label="Engineer" />
      <RadioGroup.Option id="with-error-role-designer" value="designer" label="Designer" />
      <RadioGroup.Option id="with-error-role-manager" value="manager" label="Manager" />
    </RadioGroup>
  {/if}

  <Button variant="secondary" onclick={() => (submitted = true)}>Try to submit</Button>
</div>
