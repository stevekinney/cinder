<script lang="ts" module>
  import type { HTMLSelectAttributes } from 'svelte/elements';

  export type SelectOption = { value: string; label: string; disabled?: boolean };

  export type SelectProps = HTMLSelectAttributes & {
    id: string;
    value: string;
    options: SelectOption[];
    label?: string;
    disabled?: boolean;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    id,
    value = $bindable(),
    options,
    label,
    disabled = false,
    class: className,
    ...rest
  }: SelectProps = $props();

  // Guard runs only in the browser after mount so SSR render doesn't pollute
  // server output with warnings. $effect never runs on the server in Svelte 5.
  $effect(() => {
    if (typeof window !== 'undefined' && options.length === 0) {
      console.warn('Select: options is empty');
    }
  });
</script>

<div class={classNames('cinder-select-field', className)}>
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  {#if options.length === 0}
    <select {id} class="cinder-select" {disabled} data-cinder-empty="true" {...rest}></select>
  {:else}
    <select {id} class="cinder-select" {disabled} bind:value {...rest}>
      {#each options as option (option.value)}
        <option value={option.value} disabled={option.disabled}>{option.label}</option>
      {/each}
    </select>
  {/if}
</div>
