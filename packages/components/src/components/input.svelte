<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  export type InputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

  type InputAddonProps =
    | { leading?: never; leadingInteractive?: never; trailing?: never; trailingInteractive?: never }
    | {
        leading: Snippet<[]>;
        leadingInteractive?: boolean;
        trailing?: never;
        trailingInteractive?: never;
      }
    | {
        leading?: never;
        leadingInteractive?: never;
        trailing: Snippet<[]>;
        trailingInteractive?: boolean;
      }
    | {
        leading: Snippet<[]>;
        leadingInteractive?: boolean;
        trailing: Snippet<[]>;
        trailingInteractive?: boolean;
      };

  export type InputProps = HTMLInputAttributes &
    InputAddonProps & {
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
    leading,
    trailing,
    leadingInteractive = false,
    trailingInteractive = false,
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

  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-input-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-input-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(
    error ? ariaInvalid(true) : (context?.invalid ?? rest['aria-invalid'] ?? ariaInvalid(false)),
  );
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const hasGroup = $derived(!!leading || !!trailing);
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);
</script>

{#snippet inputElement()}
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
{/snippet}

<div class="cinder-input-field">
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={resolvedDisabled || undefined}>
      {label}
    </label>
  {/if}

  {#if hasGroup}
    <div
      class="cinder-input-group"
      data-leading={leading ? '' : undefined}
      data-trailing={trailing ? '' : undefined}
      data-disabled={resolvedDisabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
    >
      {#if leading}
        <span
          class="cinder-input-group__leading"
          aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
        >
      {/if}

      {@render inputElement()}

      {#if trailing}
        <span
          class="cinder-input-group__trailing"
          aria-hidden={trailingInteractive ? undefined : 'true'}>{@render trailing()}</span
        >
      {/if}
    </div>
  {:else}
    {@render inputElement()}
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
