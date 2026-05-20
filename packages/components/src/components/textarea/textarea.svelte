<script lang="ts" module>
  export type { TextareaProps } from './textarea.types.ts';
</script>

<script lang="ts">
  import type { TextareaProps } from './textarea.types.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { resolveMaximumLength } from '../textarea-count.ts';

  let {
    id,
    value = $bindable(''),
    label,
    description,
    error,
    rows = 4,
    disabled = false,
    class: customClassName,
    maxlength,
    showCount = false,
    ...rest
  }: TextareaProps = $props();

  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const maximumLength = $derived(resolveMaximumLength(maxlength));
  const countId = $derived(showCount && maximumLength !== undefined ? `${id}-count` : undefined);
  const currentCount = $derived(value?.length ?? 0);
  const describedBy = $derived(composeDescribedBy(descriptionId, countId, errId));
</script>

<div class="cinder-textarea-field">
  {#if label}
    <label for={id} class="cinder-textarea-label">{label}</label>
  {/if}
  <textarea
    {id}
    {rows}
    {disabled}
    {maxlength}
    class={classNames('cinder-textarea', customClassName)}
    aria-invalid={ariaInvalid(!!error)}
    aria-describedby={describedBy}
    bind:value
    {...rest}
  ></textarea>
  {#if description}
    <p id={descriptionId} class="cinder-textarea-description">{description}</p>
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
    <p id={errId} class="cinder-textarea-error" aria-live="polite">{error}</p>
  {/if}
</div>
