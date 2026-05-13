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
  // grammar/spelling aria-invalid values are intentionally excluded — the visual error
  // treatment (danger border + ring) only applies to the boolean invalid state, matching
  // the standalone .cinder-input[aria-invalid='true'] rule which also ignores grammar/spelling.
  const isInvalid = $derived(
    !!error || rest['aria-invalid'] === 'true' || rest['aria-invalid'] === true,
  );
</script>

{#snippet inputElement()}
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
{/snippet}

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
    <p id={descriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
