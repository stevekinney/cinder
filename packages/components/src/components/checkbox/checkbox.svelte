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
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { commitValue } from '../../utilities/value-change.ts';

  let {
    id,
    checked = $bindable(false),
    onValueChange,
    indeterminate = $bindable(false),
    label,
    description,
    error,
    disabled,
    required,
    fieldClass,
    class: className,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    onchange: consumerOnchange,
    ...rest
  }: CheckboxProps = $props();

  // Stable generated id fallback (Svelte 5 $props.id()), used when neither the `id`
  // prop nor a FormField context controlId is present — matches input/autocomplete.
  // Passing the (possibly undefined) `id` prop as the fallback would leave field.id
  // undefined for an unlabeled standalone checkbox, breaking for=/id=/describedby.
  const generatedId = $props.id();
  const context = getFormFieldContext();
  const field = $derived(
    resolveFieldControl({
      // Conditionally spread `id` so `id: undefined` isn't passed (exactOptionalPropertyTypes);
      // matches autocomplete. The generatedId fallback covers the no-id case.
      ...(id !== undefined ? { id } : {}),
      generatedId,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'checkbox',
      consumerDescribedBy,
      consumerInvalid,
      disabled,
      // HTMLInputAttributes types `required` as boolean | null | undefined; the helper
      // wants boolean | undefined, so coerce a null to undefined (keeps false/true).
      required: required ?? undefined,
    }),
  );

  // Dev-mode guard (matches Input/Autocomplete): inside a FormField, a consumer `id`
  // that disagrees with the FormField's controlId means the FormField's <label for>
  // points at a different id than this input renders, breaking the label association.
  $effect(() => {
    if (context && id && context.controlId !== id) {
      devWarn(
        `[cinder/Checkbox] id mismatch: Checkbox id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both, or omit id on the Checkbox to inherit it.`,
      );
    }
  });

  // `indeterminate` is a DOM property, not an attribute. Sync it whenever
  // either the prop or the bound element changes. Toggling `checked` clears
  // indeterminate to match native behavior.
  let inputElement: HTMLInputElement | undefined = $state();
  $effect(() => {
    if (inputElement) {
      inputElement.indeterminate = indeterminate && !checked;
    }
  });
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;

  function syncCheckedAfterFormReset(): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (!inputElement) return;
      checked = inputElement.checked;
      inputElement.indeterminate = indeterminate && !inputElement.checked;
    }, 0);
  }

  $effect(() => {
    const form = inputElement?.form;
    if (!form) return;

    form.addEventListener('reset', syncCheckedAfterFormReset);
    return () => {
      form.removeEventListener('reset', syncCheckedAfterFormReset);
      if (resetSyncTimeout !== undefined) {
        clearTimeout(resetSyncTimeout);
        resetSyncTimeout = undefined;
      }
    };
  });

  function handleChange(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const committed = commitValue(target.checked, onValueChange, (next) => {
      checked = next;
    });
    target.checked = committed;
    target.indeterminate = indeterminate && !committed;
    consumerOnchange?.(event as Parameters<NonNullable<CheckboxProps['onchange']>>[0]);
  }
</script>

<div class={classNames('cinder-checkbox-field', fieldClass)}>
  <div class="cinder-checkbox-row">
    <span class="cinder-checkbox-field__control">
      <input
        bind:this={inputElement}
        id={field.id}
        type="checkbox"
        {...rest}
        disabled={field.disabled}
        required={field.required}
        {checked}
        onchange={handleChange}
        class={classNames('cinder-checkbox', className)}
        aria-invalid={field.ariaInvalid}
        aria-describedby={field.describedBy}
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
        {#if field.required}
          <span class="cinder-_required-marker" aria-hidden="true">*</span>
        {/if}
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
