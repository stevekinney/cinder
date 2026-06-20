<script lang="ts" module>
  /** Test-only fixture: composes CheckboxGroup with N Checkbox children for testing. */
  export type CheckboxGroupFixtureProps = {
    label?: string;
    description?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    variant?: 'default' | 'card';
    options: Array<{
      id: string;
      /** Each checkbox owns its own name — not shared across the group. */
      name: string;
      label: string;
      value?: string;
      checked?: boolean;
      description?: string;
      disabled?: boolean;
    }>;
  };
</script>

<script lang="ts">
  import CheckboxGroup from '../../components/checkbox-group/checkbox-group.svelte';
  import Checkbox from '../../components/checkbox/checkbox.svelte';

  let {
    label,
    description,
    error,
    disabled = false,
    required = false,
    variant,
    options,
  }: CheckboxGroupFixtureProps = $props();
</script>

<CheckboxGroup
  {...label !== undefined ? { label } : {}}
  {...description !== undefined ? { description } : {}}
  {...error !== undefined ? { error } : {}}
  {...variant !== undefined ? { variant } : {}}
  {disabled}
  {required}
>
  {#each options as option (option.id)}
    <Checkbox
      id={option.id}
      name={option.name}
      label={option.label}
      {...option.value !== undefined ? { value: option.value } : {}}
      {...option.checked !== undefined ? { checked: option.checked } : {}}
      {...option.description !== undefined ? { description: option.description } : {}}
      {...option.disabled !== undefined ? { disabled: option.disabled } : {}}
    />
  {/each}
</CheckboxGroup>
