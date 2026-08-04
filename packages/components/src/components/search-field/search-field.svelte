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
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import Search from 'lucide-svelte/icons/search';
  import X from 'lucide-svelte/icons/x';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { SearchFieldProps } from './search-field.types.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Input from '@lostgradient/cinder/input';

  let {
    id,
    value = $bindable(''),
    placeholder,
    shortcut,
    disabled,
    readonly,
    class: customClassName,
    oninput,
    onsearch,
    onClear,
    onkeydown: consumerKeyDown,
    ...rest
  }: SearchFieldProps = $props();

  const context = getFormFieldContext();
  const generatedId = $props.id();
  const resolvedId = $derived(id ?? context?.controlId ?? generatedId);

  let inputElement = $state<HTMLInputElement | null>(null);
  const resetTarget = untrack(() => value);

  const currentValue = $derived(value);
  const hasValue = $derived(currentValue.length > 0);

  const consumerAriaInvalid = $derived(rest['aria-invalid']);
  const resolvedAriaInvalid = $derived(context?.invalid ?? consumerAriaInvalid ?? undefined);
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);
  const resolvedRequired = $derived(rest.required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);
  const clearInert = $derived(resolvedDisabled || readonly === true);

  $effect(() => {
    if (context && id && context.controlId !== id) {
      devWarn(
        `[cinder/SearchField] id mismatch: SearchField id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  function handleInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    oninput?.(target.value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    consumerKeyDown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement });
  }

  const inputAttachment: Attachment<HTMLInputElement> = (element) => {
    inputElement = element;
    const handler = () => onsearch?.(element.value);
    const resetHandler = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        value = resetTarget;
        element.value = resetTarget;
      });
    };
    const form = element.form;
    element.addEventListener('search', handler);
    form?.addEventListener('reset', resetHandler);
    return () => {
      element.removeEventListener('search', handler);
      form?.removeEventListener('reset', resetHandler);
      if (inputElement === element) inputElement = null;
    };
  };

  function handleClear() {
    if (clearInert) return;
    if (inputElement) {
      value = '';
      inputElement.value = '';
    }
    inputElement?.focus();
    oninput?.('');
    onClear?.();
  }
</script>

{#snippet leadingIcon()}
  <span class="cinder-search-field__leading" aria-hidden="true">
    <Search class="cinder-search-field__icon" aria-hidden="true" />
  </span>
{/snippet}

{#snippet trailingContent()}
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
{/snippet}

<div
  class={classNames('cinder-search-field', customClassName)}
  data-disabled={resolvedDisabled ? '' : undefined}
  data-invalid={isInvalid ? '' : undefined}
>
  <Input
    {...rest}
    id={resolvedId}
    bind:value
    {placeholder}
    {readonly}
    type="search"
    class="cinder-search-field__input"
    disabled={resolvedDisabled}
    required={resolvedRequired}
    aria-invalid={resolvedAriaInvalid}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    {inputAttachment}
    leading={leadingIcon}
    trailing={trailingContent}
    trailingInteractive
  />
</div>
