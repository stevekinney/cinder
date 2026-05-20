<script lang="ts" module>
  /** Test-only fixture: composes RadioGroup with N Radio children for testing. */
  export type RadioGroupFixtureProps = {
    name: string;
    value?: string;
    legend?: string;
    description?: string;
    error?: string;
    disabled?: boolean;
    variant?: 'default' | 'card';
    options: Array<{
      id: string;
      value: string;
      label: string;
      disabled?: boolean;
      description?: string;
      /** Caller-supplied describedby to test composition. Mapped to `aria-describedby`. */
      ariaDescribedBy?: string;
    }>;
  };
</script>

<script lang="ts">
  import RadioGroup from '../../components/radio-group/radio-group.svelte';
  import Radio from '../../components/radio/radio.svelte';

  let {
    name,
    value = $bindable(''),
    legend,
    description,
    error,
    disabled = false,
    variant,
    options,
  }: RadioGroupFixtureProps = $props();
</script>

<RadioGroup
  {name}
  bind:value
  {...legend !== undefined ? { legend } : {}}
  {...description !== undefined ? { description } : {}}
  {...error !== undefined ? { error } : {}}
  {...variant !== undefined ? { variant } : {}}
  {disabled}
>
  {#each options as option (option.id)}
    <Radio
      id={option.id}
      value={option.value}
      label={option.label}
      {...option.disabled !== undefined ? { disabled: option.disabled } : {}}
      {...option.description !== undefined ? { description: option.description } : {}}
      {...option.ariaDescribedBy !== undefined
        ? { 'aria-describedby': option.ariaDescribedBy }
        : {}}
    />
  {/each}
</RadioGroup>
