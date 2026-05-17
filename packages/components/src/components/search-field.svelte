<script lang="ts" module>
  import type { Attachment } from 'svelte/attachments';
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
    'type' | 'value' | 'defaultValue' | 'oninput'
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
    /** Marks the input as read-only; the clear button becomes inert. */
    readonly?: boolean;
    /** `name` attribute for form submission. */
    name?: string;
    /** Additional class merged with `.cinder-search-field`. */
    class?: string;
    /** Fires on every keystroke with the current value. */
    oninput?: (value: string) => void;
    /** Fires when the native `search` event triggers (Enter or programmatic dispatch). */
    onsearch?: (value: string) => void;
    /** Fires when the clear button is clicked. */
    onclear?: () => void;
  };
</script>

<script lang="ts">
  import { DEV } from 'esm-env';

  import { Search, X } from './icons/index.ts';
  import { ariaInvalid, composeDescribedBy } from '../_internal/field-control.ts';
  import { getFormFieldContext } from '../_internal/form-field-context.ts';
  import { classNames } from '../utilities/class-names.ts';

  let {
    id,
    value,
    defaultValue,
    placeholder,
    shortcut,
    disabled,
    readonly,
    name,
    class: customClassName,
    oninput,
    onsearch,
    onclear,
    onkeydown: consumerKeyDown,
    ...rest
  }: SearchFieldProps = $props();

  const context = getFormFieldContext();
  const resolvedId = $derived(id ?? context?.controlId);

  let inputElement = $state<HTMLInputElement | null>(null);
  let uncontrolledValue = $state(defaultValue ?? '');

  const isControlled = $derived(value !== undefined);
  const currentValue = $derived(isControlled ? (value ?? '') : uncontrolledValue);
  const hasValue = $derived(currentValue.length > 0);

  const describedBy = $derived(
    composeDescribedBy(context?.descriptionId, context?.errorId, rest['aria-describedby']),
  );
  const consumerAriaInvalid = $derived(rest['aria-invalid']);
  const resolvedAriaInvalid = $derived(
    context?.invalid ?? consumerAriaInvalid ?? ariaInvalid(false),
  );
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);
  const resolvedRequired = $derived(rest.required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);
  const clearInert = $derived(resolvedDisabled || readonly === true);

  $effect(() => {
    if (!DEV) return;
    if (context && id && context.controlId !== id) {
      console.warn(
        `[cinder/SearchField] id mismatch: SearchField id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const next = target.value;
    if (!isControlled) uncontrolledValue = next;
    oninput?.(next);
  }

  function handleKeyDown(event: KeyboardEvent) {
    consumerKeyDown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement });
  }

  const searchEventListener: Attachment<HTMLInputElement> = (element) => {
    const handler = () => onsearch?.(element.value);
    element.addEventListener('search', handler);
    return () => element.removeEventListener('search', handler);
  };

  function handleClear() {
    if (clearInert) return;
    if (!isControlled && inputElement) {
      uncontrolledValue = '';
      inputElement.value = '';
    }
    inputElement?.focus();
    oninput?.('');
    onclear?.();
  }
</script>

<div
  class={classNames('cinder-search-field', customClassName)}
  data-disabled={resolvedDisabled ? '' : undefined}
  data-invalid={isInvalid ? '' : undefined}
>
  <span class="cinder-search-field__leading" aria-hidden="true">
    <Search class="cinder-search-field__icon" aria-hidden="true" />
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
    {readonly}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={describedBy}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    {@attach searchEventListener}
  />

  <button
    type="button"
    class="cinder-search-field__clear"
    aria-label="Clear search"
    tabindex={hasValue && !clearInert ? 0 : -1}
    hidden={!hasValue}
    disabled={clearInert}
    onclick={handleClear}
  >
    <X class="cinder-search-field__icon" aria-hidden="true" />
  </button>

  {#if shortcut}
    <kbd class="cinder-search-field__shortcut" aria-hidden="true">{shortcut}</kbd>
  {/if}
</div>
