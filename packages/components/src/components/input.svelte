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
    required?: boolean;
    type?: InputType;
    class?: string;
  };
</script>

<script lang="ts">
  import { DEV } from 'esm-env';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { getFormFieldContext } from '../_internal/form-field-context.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    value = $bindable(''),
    label,
    description,
    error,
    disabled,
    required,
    type = 'text',
    class: className,
    ...rest
  }: InputProps = $props();

  const context = getFormFieldContext();

  $effect(() => {
    if (!DEV) return;
    if (context && context.controlId !== id) {
      console.warn(
        `[cinder/Input] id mismatch: Input id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  // Own-element ARIA IDs (only when this Input has its own description/error props)
  const ownDescriptionId = $derived(describeId(id, !!description));
  const ownErrorId = $derived(buildErrorId(id, !!error));

  // Per-part resolution: own prop wins; context fills in when own is absent
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);

  // Final composed aria-describedby
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));

  // aria-invalid: own error wins; context fills in when own error is absent
  const resolvedAriaInvalid = $derived(
    error ? ariaInvalid(true) : (context?.invalid ?? ariaInvalid(false)),
  );

  // required/disabled: explicit prop (including false) wins over context; context wins over absent
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);
</script>

<div class="cinder-input-field">
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={resolvedDisabled || undefined}>
      {label}
    </label>
  {/if}

  <input
    {id}
    {type}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    bind:value
    class={cn('cinder-input', className)}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
    {...rest}
  />

  {#if description}
    <p id={ownDescriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
