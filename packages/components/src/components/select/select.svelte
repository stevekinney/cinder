<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Native select control with label, description, and error wiring for picking one value from a short fixed option list.
   * @tag form
   * @tag selection
   * @useWhen Picking one value from a short list where the native control's mobile behavior is desirable.
   * @useWhen Composing inside a form with built-in label and aria-describedby plumbing.
   * @avoidWhen Filtering a long list by typing — use combobox instead.
   * @avoidWhen Building a custom-styled menu trigger — use dropdown instead.
   * @related combobox, dropdown, radio-group
   */
  export type { SelectOption, SelectProps } from './select.types.ts';
</script>

<script lang="ts" generics="T extends string = string">
  import type { SelectProps } from './select.types.ts';
  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    id,
    value = $bindable(),
    options,
    label,
    description,
    error,
    required,
    disabled,
    class: className,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: SelectProps<T> = $props();

  const context = getFormFieldContext();
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'select',
      consumerDescribedBy,
      consumerInvalid,
      required,
      disabled,
    }),
  );

  const stableLocalErrorId = $derived(
    context?.errorId === `${field.id}-error` ? `${field.id}-select-error` : `${field.id}-error`,
  );

  // `devWarn` is dead-code-eliminated from production builds (gated on DEV from
  // esm-env), so the previous `typeof window` guard was redundant for the prod path.
  // It runs inside this $effect, which is client-only, so SSR is not a concern here.
  // The effect remains because `options` can change reactively (e.g. async load),
  // and we only want to surface the diagnostic once the list is genuinely empty.
  $effect(() => {
    if (options.length === 0) {
      devWarn(
        '[cinder/Select] options is empty — pass at least one option, or ignore during async load.',
      );
    }
  });
</script>

<div class={classNames('cinder-select-field', className)}>
  {#if label}
    <label for={id} class="cinder-select-field__label" data-disabled={field.disabled || undefined}>
      {label}
      {#if field.required}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}
  <span class="cinder-select-field__control">
    {#if options.length === 0}
      <select
        {id}
        class="cinder-_input-frame cinder-select"
        disabled={field.disabled}
        required={field.required}
        data-cinder-empty="true"
        {...rest}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
      ></select>
    {:else}
      <select
        {id}
        class="cinder-_input-frame cinder-select"
        disabled={field.disabled}
        required={field.required}
        bind:value
        {...rest}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
      >
        {#each options as option (option.value)}
          <option value={option.value} disabled={option.disabled}>{option.label}</option>
        {/each}
      </select>
    {/if}
    <span class="cinder-select-field__chevron" aria-hidden="true"></span>
  </span>
  {#if description}
    <p id={field.ownDescriptionId} class="cinder-select-field__description">{description}</p>
  {/if}
  <!-- Always in DOM so the live region is registered before text is injected;
       freshly-mounted aria-live nodes are not reliably announced by NVDA/JAWS. -->
  <p
    id={field.ownErrorId ?? stableLocalErrorId}
    class="cinder-select-field__error"
    aria-live="polite"
    data-cinder-error={!!error || undefined}
  >
    {error ?? ''}
  </p>
</div>
