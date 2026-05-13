<script lang="ts" module>
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  export type TextareaProps = HTMLTextareaAttributes & {
    /** Unique identifier — required for label association and ARIA wiring. */
    id: string;
    /** Bound value of the textarea. */
    value?: string;
    /** Visible label rendered in a `<label>` element associated via `for`. */
    label?: string;
    /** Helper text displayed below the textarea; wired via `aria-describedby`. */
    description?: string;
    /** Validation error message; sets `aria-invalid="true"` and `aria-describedby`. */
    error?: string;
    /** Number of visible text rows. Defaults to 4. */
    rows?: number;
    /** Disables the textarea. */
    disabled?: boolean;
    /** Extra class names merged with `.cinder-textarea`. */
    class?: string;
    /**
     * When `true` AND `maxlength` is set, renders a live character counter
     * (`{value.length}/{maxlength}`) below the textarea. The counter element
     * is wired into `aria-describedby` so screen readers announce it as part
     * of the field's description, and it is also placed inside an
     * `aria-live="polite"` region so updates are announced as the user types.
     */
    showCount?: boolean;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { classNames } from '../utilities/class-names.ts';
  import { resolveMaximumLength } from './textarea-count.ts';

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
