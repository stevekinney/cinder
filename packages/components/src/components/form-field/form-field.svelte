<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Wrapper primitive that pairs a single control with its label, description, and error and wires the ARIA association via context.
   * @tag form
   * @tag wrapper
   * @useWhen Composing a one-off field where the input does not own its own label rendering.
   * @useWhen Forwarding shared required, disabled, and error state to an opted-in child control.
   * @avoidWhen Grouping multiple related controls under one heading — use form-section instead.
   * @related form-section, label, input
   */
  export type { FormFieldProps } from './form-field.types.ts';
</script>

<script lang="ts">
  import type { FormFieldProps } from './form-field.types.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { setFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

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
