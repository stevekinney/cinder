<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Single-line text input with bound value, label, description, and error wiring for form-field accessibility.
   * @tag form
   * @tag field
   * @useWhen Collecting a single line of free-form text such as a name, email, or URL.
   * @useWhen Composing inside a form-field with leading or trailing adornments.
   * @avoidWhen Collecting multi-line prose — use textarea instead.
   * @avoidWhen Collecting a numeric value with stepping controls — use number-input instead.
   * @related textarea, number-input, search-field, form-field
   */
  export type { InputProps, InputType } from './input.types.ts';
</script>

<script lang="ts">
  import type { InputProps } from './input.types.ts';

  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { commitValue } from '../../utilities/value-change.ts';

  let {
    id,
    value = $bindable(''),
    onValueChange,
    label,
    description,
    error,
    disabled,
    required,
    type = 'text',
    class: className,
    leading,
    trailing,
    leadingInteractive = false,
    trailingInteractive = false,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: InputProps = $props();

  const context = getFormFieldContext();

  $effect(() => {
    if (context && context.controlId !== id) {
      devWarn(
        `[cinder/Input] id mismatch: Input id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'input',
      consumerDescribedBy,
      consumerInvalid,
      required,
      disabled,
    }),
  );
  const ownDescriptionId = $derived(field.ownDescriptionId);
  const ownErrorId = $derived(field.ownErrorId);
  const describedBy = $derived(field.describedBy);
  const resolvedAriaInvalid = $derived(field.ariaInvalid);
  const resolvedRequired = $derived(field.required);
  const resolvedDisabled = $derived(field.disabled);

  const isNativeDateInput = $derived(type === 'date');
  const rendersNativeDateIcon = $derived(isNativeDateInput && !trailing);
  const hasTrailing = $derived(!!trailing || isNativeDateInput);
  const hasGroupWrapper = $derived(!!leading || hasTrailing);
  const isInvalid = $derived(resolvedAriaInvalid === 'true');

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    commitValue(target.value, onValueChange, (next) => {
      value = next;
    });
  }
</script>

{#snippet calendarIcon()}
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
{/snippet}

{#snippet inputElement()}
  <input
    {id}
    {type}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    {value}
    oninput={handleInput}
    class={classNames('cinder-input', className)}
    data-cinder-native-date={rendersNativeDateIcon ? '' : undefined}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
    {...rest}
  />
{/snippet}

<div class="cinder-input-field">
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={resolvedDisabled || undefined}>
      {label}
      {#if resolvedRequired}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  {#if hasGroupWrapper}
    <div
      class="cinder-input-group"
      data-leading={leading ? '' : undefined}
      data-trailing={hasTrailing ? '' : undefined}
      data-native-date={rendersNativeDateIcon ? '' : undefined}
      data-disabled={resolvedDisabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
    >
      {#if leading}
        <span
          class="cinder-input-group__leading cinder-_truncate"
          aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
        >
      {/if}

      {@render inputElement()}

      {#if trailing}
        <span
          class="cinder-input-group__trailing cinder-_truncate"
          aria-hidden={trailingInteractive ? undefined : 'true'}>{@render trailing()}</span
        >
      {:else if rendersNativeDateIcon}
        <span
          class="cinder-input-group__trailing cinder-input-group__date-icon cinder-_truncate"
          aria-hidden="true"
        >
          {@render calendarIcon()}
        </span>
      {/if}
    </div>
  {:else}
    {@render inputElement()}
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {/if}
</div>
