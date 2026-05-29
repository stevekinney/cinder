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
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    value = $bindable(),
    options,
    label,
    description,
    error,
    required = false,
    disabled = false,
    class: className,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: SelectProps<T> = $props();

  const descriptionId = $derived(describeId(id, !!description));
  // errId is only included in aria-describedby when error is active — the element
  // itself lives permanently in the DOM (always-present live region pattern).
  const errId = $derived(buildErrorId(id, !!error));
  const describedBy = $derived(composeDescribedBy(descriptionId, errId, consumerDescribedBy));

  // Guard runs only in the browser after mount so SSR render doesn't pollute
  // server output with warnings. $effect never runs on the server in Svelte 5.
  $effect(() => {
    if (typeof window !== 'undefined' && options.length === 0) {
      console.warn('Select: options is empty');
    }
  });
</script>

<div class={classNames('cinder-select-field', className)}>
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  <span class="cinder-select-field__control">
    {#if options.length === 0}
      <select
        {id}
        class="cinder-select"
        {disabled}
        {required}
        data-cinder-empty="true"
        {...rest}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid(!!error) ?? consumerInvalid}
      ></select>
    {:else}
      <select
        {id}
        class="cinder-select"
        {disabled}
        {required}
        bind:value
        {...rest}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid(!!error) ?? consumerInvalid}
      >
        {#each options as option (option.value)}
          <option value={option.value} disabled={option.disabled}>{option.label}</option>
        {/each}
      </select>
    {/if}
    <span class="cinder-select-field__chevron" aria-hidden="true"></span>
  </span>
  {#if description}
    <p id={descriptionId} class="cinder-select-field__description">{description}</p>
  {/if}
  <!-- Always in DOM so the live region is registered before text is injected;
       freshly-mounted aria-live nodes are not reliably announced by NVDA/JAWS. -->
  <p
    id="{id}-error"
    class="cinder-select-field__error"
    aria-live="polite"
    data-cinder-error={!!error || undefined}
  >
    {error ?? ''}
  </p>
</div>
