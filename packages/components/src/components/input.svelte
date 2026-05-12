<script lang="ts" module>
  import type { Snippet } from 'svelte';
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

    /** Content rendered before the input (e.g. "$", search icon). The container
     *  is `aria-hidden="true"` by default — set `leadingInteractive={true}` if
     *  the snippet contains a focusable control. */
    leading?: Snippet<[]>;

    /** Content rendered after the input. Same a11y contract as `leading`. */
    trailing?: Snippet<[]>;

    /** When true, the leading addon container is NOT `aria-hidden`. Use for
     *  snippets that render an interactive control (e.g. a unit toggle button).
     *  The consumer's control must carry its own accessible name. */
    leadingInteractive?: boolean;

    /** When true, the trailing addon container is NOT `aria-hidden`. Use for
     *  clear buttons, password-reveal toggles, etc. The consumer's control must
     *  carry its own accessible name. */
    trailingInteractive?: boolean;
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
    leading,
    trailing,
    leadingInteractive = false,
    trailingInteractive = false,
    ...rest
  }: InputProps = $props();

  // Stable, predictable IDs for associated elements via the shared field-control
  // contract — keeps wiring identical across Input, Textarea, Select, Checkbox, Radio.
  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));

  const hasGroup = $derived(!!leading || !!trailing);
  const isInvalid = $derived(
    !!error || rest['aria-invalid'] === 'true' || rest['aria-invalid'] === true,
  );
</script>

<div class="cinder-input-field">
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={disabled || undefined}>
      {label}
    </label>
  {/if}

  {#if hasGroup}
    <div
      class="cinder-input-group"
      data-leading={leading ? '' : undefined}
      data-trailing={trailing ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
    >
      {#if leading}
        <span
          class="cinder-input-group__leading"
          aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
        >
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

      {#if trailing}
        <span
          class="cinder-input-group__trailing"
          aria-hidden={trailingInteractive ? undefined : 'true'}>{@render trailing()}</span
        >
      {/if}
    </div>
  {:else}
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
  {/if}

  {#if description}
    <p id={descriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
