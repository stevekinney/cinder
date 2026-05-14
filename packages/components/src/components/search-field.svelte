<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';

  /**
   * Props for the SearchField component.
   *
   * Renders an `<input type="search">` with a leading search icon, a clear
   * button that appears only when the field has a value, and an optional
   * `<kbd>` hint badge for a keyboard shortcut. The shortcut itself is not
   * wired by this component — the consumer is responsible for binding it
   * globally.
   *
   * Supports both controlled (`value` + `oninput`) and uncontrolled
   * (`defaultValue`) usage.
   */
  export type SearchFieldProps = Omit<
    HTMLInputAttributes,
    'type' | 'value' | 'defaultValue' | 'oninput' | 'onsearch'
  > & {
    /** Stable id for the input element. Required when composing with `FormField`. */
    id?: string;
    /** Controlled value. When provided, the field is fully controlled by the parent. */
    value?: string;
    /** Initial value for uncontrolled usage. Ignored when `value` is provided. */
    defaultValue?: string;
    /** Placeholder text. */
    placeholder?: string;
    /**
     * Optional keyboard shortcut hint (e.g. `'⌘K'`). Rendered as a trailing
     * `<kbd aria-hidden="true">` badge. The shortcut itself is not wired by
     * this component.
     */
    shortcut?: string;
    /** Disables the input and the clear button. */
    disabled?: boolean;
    /** `name` attribute for form submission. */
    name?: string;
    /** Additional class merged with `.cinder-search-field`. */
    class?: string;
    /** Fires on every keystroke with the current value. */
    oninput?: (value: string) => void;
    /** Fires on Enter or when the native `search` event triggers. */
    onsearch?: (value: string) => void;
    /** Fires when the clear button is clicked. */
    onclear?: () => void;
  };
</script>

<script lang="ts">
  import { Search, X } from './icons/index.ts';
  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { getFormFieldContext } from '../_internal/form-field-context.ts';
  import { classNames } from '../utilities/class-names.ts';

  let {
    id,
    value,
    defaultValue,
    placeholder,
    shortcut,
    disabled,
    name,
    class: customClassName,
    oninput,
    onsearch,
    onclear,
    ...rest
  }: SearchFieldProps = $props();

  const context = getFormFieldContext();
  const resolvedId = $derived(id ?? context?.controlId);

  let inputElement = $state<HTMLInputElement | null>(null);
  let uncontrolledValue = $state(defaultValue ?? '');

  const isControlled = $derived(value !== undefined);
  const currentValue = $derived(isControlled ? (value ?? '') : uncontrolledValue);
  const hasValue = $derived(currentValue.length > 0);

  const ownDescriptionId = $derived(resolvedId ? describeId(resolvedId, false) : undefined);
  const ownErrorId = $derived(resolvedId ? buildErrorId(resolvedId, false) : undefined);
  const describedBy = $derived(
    composeDescribedBy(ownDescriptionId ?? context?.descriptionId, ownErrorId ?? context?.errorId),
  );
  const resolvedAriaInvalid = $derived(context?.invalid ?? ariaInvalid(false));
  const resolvedRequired = $derived(context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  function handleInput(event: Event) {
    const next = (event.currentTarget as HTMLInputElement).value;
    if (!isControlled) uncontrolledValue = next;
    oninput?.(next);
  }

  function attachSearchListener(element: HTMLInputElement) {
    const handler = () => {
      onsearch?.(element.value);
    };
    element.addEventListener('search', handler);
    return { destroy: () => element.removeEventListener('search', handler) };
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const next = (event.currentTarget as HTMLInputElement).value;
      onsearch?.(next);
    }
  }

  function handleClear() {
    if (!isControlled) uncontrolledValue = '';
    if (inputElement) {
      inputElement.value = '';
      inputElement.focus();
    }
    oninput?.('');
    onclear?.();
  }
</script>

<div
  class={classNames('cinder-search-field', customClassName)}
  data-disabled={resolvedDisabled ? '' : undefined}
  data-invalid={resolvedAriaInvalid === 'true' ? '' : undefined}
>
  <span class="cinder-search-field__leading" aria-hidden="true">
    <Search class="cinder-search-field__icon" />
  </span>

  <input
    bind:this={inputElement}
    {...rest}
    id={resolvedId}
    {name}
    type="search"
    class="cinder-search-field__input"
    value={currentValue}
    {placeholder}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    {@attach (element) => attachSearchListener(element as HTMLInputElement).destroy}
  />

  <button
    type="button"
    class="cinder-search-field__clear"
    aria-label="Clear search"
    tabindex={hasValue ? 0 : -1}
    hidden={!hasValue}
    disabled={resolvedDisabled}
    onclick={handleClear}
  >
    <X class="cinder-search-field__icon" />
  </button>

  {#if shortcut}
    <kbd class="cinder-search-field__shortcut" aria-hidden="true">{shortcut}</kbd>
  {/if}
</div>
