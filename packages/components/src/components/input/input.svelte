<script lang="ts" module>
  export type { InputProps, InputType } from './input.types.ts';
</script>

<script lang="ts">
  import type { InputProps } from './input.types.ts';
  import { DEV } from 'esm-env';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { cn } from '../../utilities/class-names.ts';

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

  const isNativeDateInput = $derived(type === 'date');
  const rendersNativeDateIcon = $derived(isNativeDateInput && !trailing);
  const hasTrailing = $derived(!!trailing || isNativeDateInput);
  const hasGroupWrapper = $derived(!!leading || hasTrailing);
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);
</script>

{#snippet calendarIcon()}
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
{/snippet}

{#snippet inputElement()}
  <input
    {id}
    {type}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    bind:value
    class={cn('cinder-input', className)}
    data-cinder-native-date={rendersNativeDateIcon ? '' : undefined}
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

  {#if hasGroupWrapper}
    <div
      class="cinder-input-group"
      data-leading={leading ? '' : undefined}
      data-trailing={hasTrailing ? '' : undefined}
      data-native-date={rendersNativeDateIcon ? '' : undefined}
      data-disabled={resolvedDisabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
    >
      {#if leading}
        <span
          class="cinder-input-group__leading cinder-_truncate"
          aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
        >
      {/if}

      {@render inputElement()}

      {#if trailing}
        <span
          class="cinder-input-group__trailing cinder-_truncate"
          aria-hidden={trailingInteractive ? undefined : 'true'}>{@render trailing()}</span
        >
      {:else if rendersNativeDateIcon}
        <span
          class="cinder-input-group__trailing cinder-input-group__date-icon cinder-_truncate"
          aria-hidden="true"
        >
          {@render calendarIcon()}
        </span>
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
