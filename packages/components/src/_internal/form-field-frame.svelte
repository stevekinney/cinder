<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
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
    labelClass,
    descriptionClass,
    errorClass,
    descriptionId: descriptionIdOverride,
    errorId: errorIdOverride,
    controlLeading = false,
    controlTrailing = false,
    controlNativeDate = false,
    controlDisabled = false,
    controlInvalid = false,
    fullWidth = false,
    errorAlwaysMounted = false,
    control,
    before,
    after,
    message,
    ...rest
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
    labelClass?: string | undefined;
    descriptionClass?: string | undefined;
    errorClass?: string | undefined;
    descriptionId?: string | undefined;
    errorId?: string | undefined;
    controlLeading?: boolean | undefined;
    controlTrailing?: boolean | undefined;
    controlNativeDate?: boolean | undefined;
    controlDisabled?: boolean | undefined;
    controlInvalid?: boolean | undefined;
    fullWidth?: boolean | undefined;
    /**
     * Keep the error node mounted (as an empty live region) even when `error`
     * is falsy. `data-cinder-error` always reflects whether `error` is set
     * (regardless of this flag), so CSS can hide the pre-mounted, errorless
     * node visually without unmounting it — e.g. `.foo__error:not([data-cinder-error])`.
     * Some fields (Select, Combobox, MultiSelect) must pre-mount their
     * `aria-live` error region — a freshly-mounted live region is not
     * reliably announced by NVDA/JAWS, so the node has to exist before an
     * error string is ever assigned into it.
     */
    errorAlwaysMounted?: boolean | undefined;
    control: Snippet;
    before?: Snippet | undefined;
    after?: Snippet | undefined;
    /** Extra content rendered between description and error, such as a live character counter or a non-error status message. */
    message?: Snippet | undefined;
  } & Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> = $props();

  const labelId = $derived(label ? `${id}-label` : undefined);
  const descriptionId = $derived(descriptionIdOverride ?? describeId(id, !!description));
  const errorId = $derived(errorIdOverride ?? buildErrorId(id, !!error));
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

<div
  {...rest}
  class={classNames('cinder-form-field', className)}
  data-cinder-full-width={fullWidth ? '' : undefined}
>
  {#if label}
    <label
      id={labelId}
      for={id}
      class={classNames('cinder-form-field__label', labelClass, hideLabel && 'cinder-sr-only')}
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
  {#if message}{@render message()}{/if}
  {#if error || errorAlwaysMounted}
    <p
      id={errorId}
      class={classNames('cinder-form-field__error', errorClass)}
      aria-live="polite"
      data-cinder-error={error ? '' : undefined}
    >
      {error ?? ''}
    </p>
  {/if}
</div>
