<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';

  export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

  export type InputProps = HTMLInputAttributes & {
    id: string;
    value: string;
    label?: string;
    description?: string;
    error?: string;
    disabled?: boolean;
    type?: InputType;
    class?: string;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    value = $bindable(''),
    label,
    description,
    error,
    disabled = false,
    type = 'text',
    class: className,
    ...rest
  }: InputProps = $props();

  // Stable, predictable IDs for associated elements via the shared field-control
  // contract — keeps wiring identical across Input, Textarea, Select, Checkbox, Radio.
  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));
</script>

<div class="cinder-input-field">
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={disabled || undefined}>
      {label}
    </label>
  {/if}

  <input
    {id}
    {type}
    {disabled}
    bind:value
    class={cn('cinder-input', className)}
    aria-invalid={ariaInvalid(!!error)}
    aria-describedby={describedBy}
    {...rest}
  />

  {#if description}
    <p id={descriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
