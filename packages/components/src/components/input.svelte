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

  // Build stable, predictable IDs for associated elements so `aria-describedby`
  // references don't collide across multiple inputs on the same page.
  const descriptionId = $derived(description ? `${id}-description` : undefined);
  const errorId = $derived(error ? `${id}-error` : undefined);

  // Both description and error can coexist — screen readers announce both.
  const describedBy = $derived(
    [descriptionId, errorId].filter((v): v is string => v !== undefined).join(' ') || undefined,
  );
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
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}
    {...rest}
  />

  {#if description}
    <p id={descriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errorId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
