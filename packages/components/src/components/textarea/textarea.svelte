<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Multi-line text input with label, description, and error wiring plus an optional live character counter against maxlength.
   * @tag form
   * @tag field
   * @useWhen Collecting multi-line prose such as comments, descriptions, or messages.
   * @useWhen Surfacing a remaining-character counter as the user types against a maxlength.
   * @avoidWhen Collecting a single short line of text — use input instead.
   * @related input
   */
  export type { TextareaProps } from './textarea.types.ts';
</script>

<script lang="ts">
  import type { TextareaProps } from './textarea.types.ts';
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { resolveMaximumLength } from '../textarea-count.ts';
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';

  let {
    id,
    value = $bindable(''),
    label,
    description,
    error,
    rows = 4,
    disabled,
    required,
    class: customClassName,
    variant = 'default',
    maxlength,
    countVisible = false,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: TextareaProps = $props();

  const context = getFormFieldContext();
  const maximumLength = $derived(resolveMaximumLength(maxlength));
  const countId = $derived(countVisible && maximumLength !== undefined ? `${id}-count` : undefined);
  const currentCount = $derived(value?.length ?? 0);
  const ownRequired = $derived(required ?? undefined);
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'textarea',
      consumerDescribedBy,
      consumerInvalid,
      additionalDescribedBy: [countId],
      required: ownRequired,
      disabled,
    }),
  );
</script>

{#snippet textareaControl()}
  <textarea
    {id}
    {rows}
    disabled={field.disabled}
    required={field.required}
    {maxlength}
    class={classNames('cinder-_input-frame', 'cinder-textarea', customClassName)}
    data-cinder-variant={variant}
    aria-invalid={field.ariaInvalid}
    aria-describedby={field.describedBy}
    bind:value
    {...rest}
  ></textarea>
{/snippet}

{#snippet counter()}
  {#if countId}
    <output
      id={countId}
      for={id}
      class="cinder-textarea-count"
      aria-live="polite"
      aria-atomic="true"
    >
      {currentCount}/{maximumLength}
    </output>
  {/if}
{/snippet}

<!-- `message` is passed unconditionally (the snippet guards its own content
     with `{#if countId}`) rather than `countId ? counter : undefined` —
     Svelte 5 does not reliably re-toggle a child's `{#if messageProp}` when a
     snippet-typed prop's presence itself (not just content read inside the
     snippet) changes reactively across renders. -->
{#if context}
  {#if label || description || error || countId}
    <FormFieldFrame
      id={field.id}
      label={context.labelId ? undefined : label}
      {description}
      {error}
      required={field.required}
      disabled={field.disabled}
      class="cinder-textarea-field"
      labelClass="cinder-textarea-label"
      descriptionClass="cinder-textarea-description"
      errorClass="cinder-textarea-error"
      descriptionId={field.ownDescriptionId}
      errorId={field.ownErrorId}
      control={textareaControl}
      message={counter}
    />
  {:else}
    {@render textareaControl()}
  {/if}
{:else}
  <FormFieldFrame
    id={field.id}
    {label}
    {description}
    {error}
    required={field.required}
    disabled={field.disabled}
    class="cinder-textarea-field"
    labelClass="cinder-textarea-label"
    descriptionClass="cinder-textarea-description"
    errorClass="cinder-textarea-error"
    control={textareaControl}
    message={counter}
  />
{/if}
