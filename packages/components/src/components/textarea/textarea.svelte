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
   * @related input, markdown-editor
   */
  export type { TextareaProps } from './textarea.types.ts';
</script>

<script lang="ts">
  import type { TextareaProps } from './textarea.types.ts';
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { resolveMaximumLength } from '../textarea-count.ts';

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
    maxlength,
    showCount = false,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: TextareaProps = $props();

  const context = getFormFieldContext();
  const maximumLength = $derived(resolveMaximumLength(maxlength));
  const countId = $derived(showCount && maximumLength !== undefined ? `${id}-count` : undefined);
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

<div class="cinder-textarea-field">
  {#if label}
    <label for={id} class="cinder-textarea-label">{label}</label>
  {/if}
  <textarea
    {id}
    {rows}
    disabled={field.disabled}
    required={field.required}
    {maxlength}
    class={classNames('cinder-_input-frame', 'cinder-textarea', customClassName)}
    aria-invalid={field.ariaInvalid}
    aria-describedby={field.describedBy}
    bind:value
    {...rest}
  ></textarea>
  {#if description}
    <p id={field.ownDescriptionId} class="cinder-textarea-description">{description}</p>
  {/if}
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
  {#if error}
    <p id={field.ownErrorId} class="cinder-textarea-error" aria-live="polite">{error}</p>
  {/if}
</div>
