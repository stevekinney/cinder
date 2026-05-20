<script lang="ts" module>
  export type { CheckboxProps } from './checkbox.types.ts';
</script>

<script lang="ts">
  import type { CheckboxProps } from './checkbox.types.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    description,
    error,
    disabled = false,
    class: className,
    ...rest
  }: CheckboxProps = $props();

  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));

  // `indeterminate` is a DOM property, not an attribute. Sync it whenever
  // either the prop or the bound element changes. Toggling `checked` clears
  // indeterminate to match native behavior.
  let inputElement: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (inputElement) {
      inputElement.indeterminate = indeterminate && !checked;
    }
  });
</script>

<div class="cinder-checkbox-field">
  <div class="cinder-checkbox-row">
    <input
      bind:this={inputElement}
      {id}
      type="checkbox"
      {disabled}
      bind:checked
      class={cn('cinder-checkbox', className)}
      aria-invalid={ariaInvalid(!!error)}
      aria-describedby={describedBy}
      {...rest}
    />
    {#if label}
      <label for={id} class="cinder-checkbox-field__label" data-disabled={disabled || undefined}>
        {label}
      </label>
    {/if}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-checkbox-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-checkbox-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
