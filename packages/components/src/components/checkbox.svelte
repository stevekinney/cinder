<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';

  /**
   * Props for the Checkbox component.
   *
   * Backed by a native `<input type="checkbox">` so it participates in form
   * submission and reset without extra wiring. The component owns the
   * label/description/error wrapper but delegates state, `name`, `value`,
   * and `disabled` semantics to the native element.
   *
   * `indeterminate` is a DOM property, not an attribute — Svelte's effect
   * sets it imperatively each time the prop changes, then clears it once
   * the user toggles `checked`.
   */
  export type CheckboxProps = HTMLInputAttributes & {
    /** Unique identifier — required for label association and ARIA wiring. */
    id: string;
    /** Bound checked state. */
    checked?: boolean;
    /** Bound indeterminate state. Mutually exclusive with `checked` visually. */
    indeterminate?: boolean;
    /** Visible label rendered in a `<label>` element associated via `for`. */
    label?: string;
    /** Helper text displayed below the checkbox; wired via `aria-describedby`. */
    description?: string;
    /** Validation error message; sets `aria-invalid="true"` and `aria-describedby`. */
    error?: string;
    /** Disables the checkbox. */
    disabled?: boolean;
    /** Extra class names merged with `.cinder-checkbox`. */
    class?: string;
  };
</script>

<script lang="ts">
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    description,
    error,
    disabled = false,
    class: className,
    ...rest
  }: CheckboxProps = $props();

  const descriptionId = $derived(describeId(id, !!description));
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId));

  // `indeterminate` is a DOM property, not an attribute. Sync it whenever
  // either the prop or the bound element changes. Toggling `checked` clears
  // indeterminate to match native behavior.
  let inputElement: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (inputElement) {
      inputElement.indeterminate = indeterminate && !checked;
    }
  });
</script>

<div class="cinder-checkbox-field">
  <div class="cinder-checkbox-row">
    <input
      bind:this={inputElement}
      {id}
      type="checkbox"
      {disabled}
      bind:checked
      class={cn('cinder-checkbox', className)}
      aria-invalid={ariaInvalid(!!error)}
      aria-describedby={describedBy}
      {...rest}
    />
    {#if label}
      <label for={id} class="cinder-checkbox-field__label" data-disabled={disabled || undefined}>
        {label}
      </label>
    {/if}
  </div>

  {#if description}
    <p id={descriptionId} class="cinder-checkbox-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={errId} class="cinder-checkbox-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
