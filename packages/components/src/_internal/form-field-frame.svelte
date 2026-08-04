<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from './field-control.ts';
  import type { FormFieldContext } from './form-field-context.ts';
  import FormFieldProvider from './form-field-provider.svelte';
  import { classNames } from '../utilities/class-names.ts';

  let {
    id,
    label,
    hideLabel = false,
    description,
    error,
    required = false,
    disabled = false,
    class: className,
    controlClass,
    descriptionClass,
    errorClass,
    controlLeading = false,
    controlTrailing = false,
    controlNativeDate = false,
    controlDisabled = false,
    controlInvalid = false,
    control,
    before,
    after,
  }: {
    id: string;
    label?: string | undefined;
    hideLabel?: boolean | undefined;
    description?: string | undefined;
    error?: string | undefined;
    required?: boolean | undefined;
    disabled?: boolean | undefined;
    class?: string | undefined;
    controlClass?: string | undefined;
    descriptionClass?: string | undefined;
    errorClass?: string | undefined;
    controlLeading?: boolean | undefined;
    controlTrailing?: boolean | undefined;
    controlNativeDate?: boolean | undefined;
    controlDisabled?: boolean | undefined;
    controlInvalid?: boolean | undefined;
    control: Snippet;
    before?: Snippet | undefined;
    after?: Snippet | undefined;
  } = $props();

  const labelId = $derived(label ? `${id}-label` : undefined);
  const descriptionId = $derived(describeId(id, !!description));
  const errorId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errorId));
  const invalid = $derived(ariaInvalid(!!error));
  const needsControlWrapper = $derived(!!controlClass || !!before || !!after);
  const context: FormFieldContext = {
    get controlId() {
      return id;
    },
    get labelId() {
      return labelId;
    },
    get describedBy() {
      return describedBy;
    },
    get descriptionId() {
      return descriptionId;
    },
    get errorId() {
      return errorId;
    },
    get invalid() {
      return invalid;
    },
    get required() {
      return required;
    },
    get disabled() {
      return disabled;
    },
  };
</script>

<div class={classNames('cinder-form-field', className)} data-cinder-full-width>
  {#if label}
    <label
      id={labelId}
      for={id}
      class={classNames('cinder-form-field__label', hideLabel && 'cinder-sr-only')}
      data-disabled={disabled || undefined}
    >
      {label}
      {#if required}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  {#if needsControlWrapper}<div
      class={classNames('cinder-form-field__control', controlClass)}
      data-leading={controlLeading ? '' : undefined}
      data-trailing={controlTrailing ? '' : undefined}
      data-native-date={controlNativeDate ? '' : undefined}
      data-disabled={controlDisabled ? '' : undefined}
      data-invalid={controlInvalid ? '' : undefined}
    >
      {#if before}{@render before()}{/if}
      <FormFieldProvider {context}>{@render control()}</FormFieldProvider>
      {#if after}{@render after()}{/if}
    </div>{:else}<FormFieldProvider {context}>{@render control()}</FormFieldProvider>{/if}

  {#if description}
    <p id={descriptionId} class={classNames('cinder-form-field__description', descriptionClass)}>
      {description}
    </p>
  {/if}
  {#if error}
    <p id={errorId} class={classNames('cinder-form-field__error', errorClass)} aria-live="polite">
      {error}
    </p>
  {/if}
</div>
