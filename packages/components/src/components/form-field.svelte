<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type FormFieldProps = {
    /** Required stable id — used for `<label for>`, description, error, and the child control's id via context. */
    id: string;
    /** Visible label text. Required — the primitive's whole purpose is label association. */
    label: string;
    /** Helper text rendered below the control; wired into `aria-describedby`. */
    description?: string;
    /** Validation error; sets `aria-invalid="true"` on opted-in controls via context. */
    error?: string;
    /** Renders a visual required marker and exposes `required: true` on the context. */
    required?: boolean;
    /** Propagated to opted-in controls via context. Does not style FormField itself. */
    disabled?: boolean;
    /** Additional class merged with `.cinder-form-field`. */
    class?: string;
    /** Control(s) rendered inside the field. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { setFormFieldContext } from '../_internal/form-field-context.ts';
  import { classNames } from '../utilities/class-names.ts';

  let {
    id,
    label,
    description,
    error,
    required = false,
    disabled = false,
    class: className,
    children,
  }: FormFieldProps = $props();

  const labelId = $derived(`${id}-label`);
  const descriptionId = $derived(describeId(id, !!description));
  const errorId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errorId));
  const invalid = $derived(ariaInvalid(!!error));

  setFormFieldContext({
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
  });
</script>

<div class={classNames('cinder-form-field', className)}>
  <label
    id={labelId}
    for={id}
    class="cinder-form-field__label"
    data-disabled={disabled || undefined}
  >
    {label}
    {#if required}
      <span class="cinder-form-field__required" aria-hidden="true"></span>
    {/if}
  </label>

  {@render children()}

  {#if description}
    <p id={descriptionId} class="cinder-form-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errorId} class="cinder-form-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
