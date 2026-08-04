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
  import FormFieldFrame from '../../_internal/form-field-frame.svelte';

  let {
    id,
    value = $bindable(''),
    onValueChangeRequest,
    onValueChange,
    label,
    hideLabel = false,
    description,
    error,
    disabled,
    required,
    type = 'text',
    inputAttachment,
    groupClassName,
    class: className,
    leading,
    trailing,
    leadingInteractive = false,
    trailingInteractive = false,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    oninput: consumerOninput,
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
  const describedBy = $derived(field.describedBy);
  const resolvedAriaInvalid = $derived(field.ariaInvalid);
  const resolvedRequired = $derived(field.required);
  const resolvedDisabled = $derived(field.disabled);

  const isNativeDateInput = $derived(type === 'date');
  const rendersNativeDateIcon = $derived(isNativeDateInput && !trailing);
  const hasTrailing = $derived(!!trailing || isNativeDateInput);
  const hasGroupWrapper = $derived(!!leading || hasTrailing);
  const isInvalid = $derived(resolvedAriaInvalid === 'true');
  const groupModifiers = $derived(
    classNames(
      leading && 'cinder-input-group--leading',
      hasTrailing && 'cinder-input-group--trailing',
      rendersNativeDateIcon && 'cinder-input-group--native-date',
      resolvedDisabled && 'cinder-input-group--disabled',
      isInvalid && 'cinder-input-group--invalid',
    ),
  );
  let inputNode: HTMLInputElement | undefined = $state();
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;

  function syncValueAfterFormReset(): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (inputNode) value = inputNode.value;
    }, 0);
  }

  $effect(() => {
    const form = inputNode?.form;
    if (!form) return;

    form.addEventListener('reset', syncValueAfterFormReset);
    return () => {
      form.removeEventListener('reset', syncValueAfterFormReset);
      if (resetSyncTimeout !== undefined) {
        clearTimeout(resetSyncTimeout);
        resetSyncTimeout = undefined;
      }
    };
  });

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const committed = commitValue(
      target.value,
      onValueChangeRequest,
      (next) => {
        value = next;
      },
      onValueChange,
    );
    target.value = committed;
    consumerOninput?.(event as Parameters<NonNullable<InputProps['oninput']>>[0]);
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
    bind:this={inputNode}
    {@attach inputAttachment}
    {id}
    {type}
    {...rest}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    {value}
    oninput={handleInput}
    class={classNames('cinder-input', className)}
    data-cinder-full-width
    data-cinder-native-date={rendersNativeDateIcon ? '' : undefined}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
  />
{/snippet}

{#snippet control()}
  {#if hasGroupWrapper}
    <div
      class={classNames('cinder-input-group', groupClassName, groupModifiers)}
      data-leading={leading ? '' : undefined}
      data-trailing={hasTrailing ? '' : undefined}
      data-native-date={rendersNativeDateIcon ? '' : undefined}
      data-disabled={resolvedDisabled ? '' : undefined}
      data-invalid={isInvalid ? '' : undefined}
      data-cinder-full-width
    >
      {#if leading}
        <span
          class={classNames(
            'cinder-input-group__leading',
            !leadingInteractive && 'cinder-_truncate',
          )}
          aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
        >
      {/if}

      {@render inputElement()}

      {#if trailing}
        <span
          class={classNames(
            'cinder-input-group__trailing',
            !trailingInteractive && 'cinder-_truncate',
          )}
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
{/snippet}

{#snippet leadingAdornment()}
  {#if leading}
    <span
      class={classNames('cinder-input-group__leading', !leadingInteractive && 'cinder-_truncate')}
      aria-hidden={leadingInteractive ? undefined : 'true'}>{@render leading()}</span
    >
  {/if}
{/snippet}
{#snippet trailingAdornment()}
  {#if trailing}
    <span
      class={classNames('cinder-input-group__trailing', !trailingInteractive && 'cinder-_truncate')}
      aria-hidden={trailingInteractive ? undefined : 'true'}>{@render trailing()}</span
    >
  {:else if rendersNativeDateIcon}
    <span
      class="cinder-input-group__trailing cinder-input-group__date-icon cinder-_truncate"
      aria-hidden="true">{@render calendarIcon()}</span
    >
  {/if}
{/snippet}

{#if context}
  {#if label || description || error}
    <FormFieldFrame
      {id}
      label={context.labelId ? undefined : label}
      {hideLabel}
      {description}
      {error}
      required={resolvedRequired}
      disabled={resolvedDisabled}
      class="cinder-input-field"
      fullWidth
      descriptionClass="cinder-input-field__description"
      errorClass="cinder-input-field__error"
      descriptionId={field.ownDescriptionId}
      errorId={field.ownErrorId}
      control={inputElement}
      controlClass={hasGroupWrapper
        ? classNames('cinder-input-group', groupClassName, groupModifiers)
        : undefined}
      controlLeading={!!leading}
      controlTrailing={hasTrailing}
      controlNativeDate={rendersNativeDateIcon}
      controlDisabled={resolvedDisabled}
      controlInvalid={isInvalid}
      before={hasGroupWrapper ? leadingAdornment : undefined}
      after={hasGroupWrapper ? trailingAdornment : undefined}
    />
  {:else}
    {@render control()}
  {/if}
{:else}
  <FormFieldFrame
    {id}
    {label}
    {hideLabel}
    {description}
    {error}
    required={required ?? false}
    disabled={disabled ?? false}
    class="cinder-input-field"
    fullWidth
    descriptionClass="cinder-input-field__description"
    errorClass="cinder-input-field__error"
    control={inputElement}
    controlClass={hasGroupWrapper
      ? classNames('cinder-input-group', groupClassName, groupModifiers)
      : undefined}
    controlLeading={!!leading}
    controlTrailing={hasTrailing}
    controlNativeDate={rendersNativeDateIcon}
    controlDisabled={resolvedDisabled}
    controlInvalid={isInvalid}
    before={hasGroupWrapper ? leadingAdornment : undefined}
    after={hasGroupWrapper ? trailingAdornment : undefined}
  />
{/if}
