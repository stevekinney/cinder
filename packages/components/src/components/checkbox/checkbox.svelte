<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Binary or tri-state selection control with bindable checked and indeterminate state for forms and lists.
   * @tag form
   * @tag selection
   * @useWhen Selecting zero or more independent options from a list.
   * @useWhen Representing a parent state that aggregates child selections via indeterminate.
   * @avoidWhen Flipping a single setting on or off with immediate effect — use toggle instead.
   * @avoidWhen Picking exactly one option from a small fixed set — use RadioGroup or segmented-control instead.
   * @related checkbox-group, radio-group, toggle, segmented-control
   */
  export type { CheckboxProps } from './checkbox.types.ts';
</script>

<script lang="ts">
  import type { CheckboxProps } from './checkbox.types.ts';
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    description,
    error,
    disabled,
    class: className,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: CheckboxProps = $props();

  const context = getFormFieldContext();
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'checkbox',
      consumerDescribedBy,
      consumerInvalid,
      disabled,
    }),
  );

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
    <span class="cinder-checkbox-field__control">
      <input
        bind:this={inputElement}
        id={field.id}
        type="checkbox"
        disabled={field.disabled}
        bind:checked
        class={classNames('cinder-checkbox', className)}
        aria-invalid={field.ariaInvalid}
        aria-describedby={field.describedBy}
        {...rest}
      />
      <span class="cinder-checkbox-field__indicator" aria-hidden="true"></span>
    </span>
    {#if label}
      <label
        for={field.id}
        class="cinder-checkbox-field__label"
        data-disabled={field.disabled || undefined}
      >
        {label}
      </label>
    {/if}
  </div>

  {#if description}
    <p id={field.ownDescriptionId} class="cinder-checkbox-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={field.ownErrorId} class="cinder-checkbox-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
