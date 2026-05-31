<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Search input with a leading icon, automatic clear button, and optional keyboard shortcut hint badge.
   * @tag form
   * @tag search
   * @useWhen Capturing a free-text query that filters or queries a larger dataset.
   * @useWhen Surfacing a global search affordance with a visible keyboard shortcut.
   * @avoidWhen Selecting from a constrained list of known options — use combobox instead.
   * @related input, combobox
   */
  export type { SearchFieldProps } from './search-field.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { Search, X } from '../icons/index.ts';
  import type { SearchFieldProps } from './search-field.types.ts';
  import { ariaInvalid, composeDescribedBy } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

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
  let uncontrolledValue = $state(untrack(() => defaultValue) ?? '');

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
