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
    labelVisible = true,
    description,
    warning,
    error,
    managed,
    required = false,
    disabled = false,
    class: className,
    controlClass,
    labelClass,
    descriptionClass,
    warningClass,
    errorClass,
    descriptionId: descriptionIdOverride,
    errorId: errorIdOverride,
    controlLeading = false,
    controlTrailing = false,
    controlNativeDate = false,
    controlDisabled = false,
    controlInvalid = false,
    fullWidth = false,
    errorMountedOnDemand = false,
    control,
    before,
    after,
    message,
    ...rest
  }: {
    id: string;
    label?: string | undefined;
    labelVisible?: boolean | undefined;
    description?: string | undefined;
    warning?: string | undefined;
    error?: string | undefined;
    managed?: { by?: string | undefined; reason?: string | undefined } | undefined;
    required?: boolean | undefined;
    disabled?: boolean | undefined;
    class?: string | undefined;
    controlClass?: string | undefined;
    labelClass?: string | undefined;
    descriptionClass?: string | undefined;
    warningClass?: string | undefined;
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
     * Opt out of the default always-mounted error live region, and only
     * mount the error node once `error` is actually set — so when this flag
     * is `true`, there is no errorless node in the DOM to hide, and no
     * pre-mounted `aria-live` region ready for an announcement.
     *
     * In the default (`false`) mode, the node is always present, and
     * `data-cinder-error` reflects whether `error` is currently set so CSS
     * can hide the errorless node visually without unmounting it — e.g.
     * `.foo__error:not([data-cinder-error])` (see the shared
     * `_form-field-error.css` partial). The node is pre-mounted as an empty
     * `aria-live` region by default because a freshly-mounted live region is
     * not reliably announced by NVDA/JAWS — the node has to exist before an
     * error string is ever assigned into it. Only opt into on-demand
     * mounting when a consumer has a specific reason not to pre-mount.
     */
    errorMountedOnDemand?: boolean | undefined;
    control: Snippet;
    before?: Snippet | undefined;
    after?: Snippet | undefined;
    /** Extra content rendered between description and error, such as a live character counter or a non-error status message. */
    message?: Snippet | undefined;
  } & Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> = $props();

  const labelId = $derived(label ? `${id}-label` : undefined);
  const descriptionId = $derived(descriptionIdOverride ?? describeId(id, !!description));
  const warningId = $derived(warning ? `${id}-warning` : undefined);
  const managedId = $derived(managed ? `${id}-managed` : undefined);
  const errorId = $derived(errorIdOverride ?? buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, warningId, managedId, errorId));
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
    get warningId() {
      return warningId;
    },
    get managedId() {
      return managedId;
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
  data-cinder-managed={managed ? '' : undefined}
  data-cinder-managed-by={managed?.by || undefined}
>
  {#if label}
    <label
      id={labelId}
      for={id}
      class={classNames('cinder-form-field__label', labelClass, !labelVisible && 'cinder-sr-only')}
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
  {#if warning}
    <p id={warningId} class={classNames('cinder-form-field__warning', warningClass)}>
      {warning}
    </p>
  {/if}
  {#if managed}
    <p id={managedId} class="cinder-form-field__managed">
      {managed.by ? `Managed by ${managed.by}` : 'Managed by policy'}{managed.reason
        ? `: ${managed.reason}`
        : ''}
    </p>
  {/if}
  {#if message}{@render message()}{/if}
  {#if error || !errorMountedOnDemand}
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
