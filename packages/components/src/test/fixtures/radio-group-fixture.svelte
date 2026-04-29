<script lang="ts" module>
  /** Test-only fixture: composes RadioGroup with N Radio children for testing. */
  export type RadioGroupFixtureProps = {
    name: string;
    value?: string;
    legend?: string;
    description?: string;
    error?: string;
    disabled?: boolean;
    options: Array<{ id: string; value: string; label: string; disabled?: boolean }>;
  };
</script>

<script lang="ts">
  import RadioGroup from '../../components/radio-group.svelte';
  import Radio from '../../components/radio.svelte';

  let {
    name,
    value = $bindable(''),
    legend,
    description,
    error,
    disabled = false,
    options,
  }: RadioGroupFixtureProps = $props();
</script>

<RadioGroup
  {name}
  bind:value
  {...legend !== undefined ? { legend } : {}}
  {...description !== undefined ? { description } : {}}
  {...error !== undefined ? { error } : {}}
  {disabled}
>
  {#each options as option (option.id)}
    {#if option.disabled !== undefined}
      <Radio id={option.id} value={option.value} label={option.label} disabled={option.disabled} />
    {:else}
      <Radio id={option.id} value={option.value} label={option.label} />
    {/if}
  {/each}
</RadioGroup>
