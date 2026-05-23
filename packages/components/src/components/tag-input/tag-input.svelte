<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Free-form token entry field that turns committed text into removable tags while keeping native input, form, and accessibility wiring intact.
   * @tag form
   * @tag tags
   * @useWhen Collecting zero or more short free-form values such as labels, emails, or technologies.
   * @useWhen Letting users review and remove committed values inline before submitting a form.
   * @avoidWhen Users must choose from a fixed option list — use combobox instead.
   * @avoidWhen The value is a single free-form string rather than a list — use input instead.
   * @related combobox, chip, form-field, input
   */
  export type { TagInputProps } from './tag-input.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import { tick, untrack } from 'svelte';

  import { ariaInvalid, composeDescribedBy } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { handleRovingKeydown, isRovingKey } from '../../utilities/roving-tabindex.ts';
  import { useId } from '../../utilities/use-id.ts';
  import type { TagInputProps } from './tag-input.types.ts';

  const generatedId = useId('cinder-tag-input');

  let {
    id,
    value,
    defaultValue,
    delimiter = ',',
    max,
    validate,
    allowDuplicates = false,
    disabled,
    readonly = false,
    name,
    class: className,
    oninput: consumerInput,
    onkeydown: consumerKeyDown,
    onfocus: consumerFocus,
    onblur: consumerBlur,
    'aria-describedby': consumerDescribedBy,
    'aria-label': consumerAriaLabel,
    'aria-labelledby': consumerAriaLabelledBy,
    required: _ignoredRequired,
    onchange,
    ...rest
  }: TagInputProps & {
    required?: boolean;
  } = $props();

  const initialDefaultTags = untrack(() => [...(defaultValue ?? [])]);

  const context = getFormFieldContext();
  const resolvedId = $derived(id ?? context?.controlId ?? generatedId);
  const listboxId = $derived(`${resolvedId}-listbox`);
  const inlineErrorId = $derived(`${resolvedId}-inline-error`);

  let rootElement = $state<HTMLDivElement | null>(null);
  let inputElement = $state<HTMLInputElement | null>(null);
  let draftValue = $state('');
  let inlineError = $state<string | null>(null);
  let uncontrolledTags = $state(initialDefaultTags);
  let focusedChipIndex = $state(-1);

  const isControlled = $derived(value !== undefined);
  const currentTags = $derived(isControlled ? (value ?? []) : uncontrolledTags);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);
  const resolvedReadonly = $derived(readonly === true);
  const resolvedRequired = $derived(context?.required ?? false);
  const resolvedMax = $derived(
    Number.isFinite(max) ? Math.max(0, Math.floor(max as number)) : undefined,
  );
  const labelledBy = $derived(composeDescribedBy(context?.labelId, consumerAriaLabelledBy));
  const ariaLabel = $derived(
    labelledBy ? undefined : consumerAriaLabel?.trim() ? consumerAriaLabel : undefined,
  );
  const describedBy = $derived(
    composeDescribedBy(
      context?.descriptionId,
      context?.errorId,
      inlineError ? inlineErrorId : undefined,
      consumerDescribedBy,
    ),
  );
  const consumerAriaInvalid = $derived(rest['aria-invalid']);
  const resolvedAriaInvalid = $derived(
    inlineError
      ? ariaInvalid(true)
      : (context?.invalid ?? consumerAriaInvalid ?? ariaInvalid(false)),
  );
  const isInvalid = $derived(resolvedAriaInvalid === 'true' || resolvedAriaInvalid === true);

  $effect(() => {
    if (!DEV) return;
    if (context && id && context.controlId !== id) {
      console.warn(
        `[cinder/TagInput] id mismatch: TagInput id="${id}" but wrapping FormField expects controlId="${context.controlId}". Set the same id on both.`,
      );
    }
  });

  $effect(() => {
    if (focusedChipIndex >= currentTags.length) {
      focusedChipIndex = -1;
    }
  });

  $effect(() => {
    if (isControlled || !inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onReset = () => {
      uncontrolledTags = [...initialDefaultTags];
      draftValue = '';
      inlineError = null;
      focusedChipIndex = -1;
    };

    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  });

  function getChipElements(): HTMLLIElement[] {
    return Array.from(
      rootElement?.querySelectorAll<HTMLLIElement>('.cinder-tag-input__chip') ?? [],
    );
  }

  async function focusChip(index: number): Promise<void> {
    await tick();
    const chip = getChipElements()[index];
    chip?.focus();
  }

  async function focusInput(): Promise<void> {
    await tick();
    inputElement?.focus();
  }

  function setTags(nextTags: string[]): void {
    const normalized = [...nextTags];
    if (!isControlled) {
      uncontrolledTags = normalized;
    }
    onchange?.(normalized);
  }

  function validationError(candidate: string): string | null {
    if (resolvedMax !== undefined && currentTags.length >= resolvedMax) {
      return `You can add up to ${resolvedMax} tag${resolvedMax === 1 ? '' : 's'}.`;
    }

    if (!allowDuplicates && currentTags.some((tag) => tag.trim() === candidate)) {
      return `"${candidate}" is already added.`;
    }

    const result = validate?.(candidate);
    if (result === false) return 'Enter a valid tag.';
    if (typeof result === 'string' && result.trim().length > 0) return result;

    return null;
  }

  function matchesDelimiter(key: string): boolean {
    if (typeof delimiter === 'string') return key === delimiter;
    const expression = new RegExp(delimiter.source, delimiter.flags.replaceAll('g', ''));
    return expression.test(key);
  }

  function commitDraft(): boolean {
    if (resolvedDisabled || resolvedReadonly) return false;
    const candidate = draftValue.trim();
    if (!candidate) return false;

    const errorMessage = validationError(candidate);
    if (errorMessage) {
      inlineError = errorMessage;
      return false;
    }

    inlineError = null;
    draftValue = '';
    focusedChipIndex = -1;
    setTags([...currentTags, candidate]);
    return true;
  }

  function removeTag(index: number): void {
    if (resolvedDisabled || resolvedReadonly) return;
    inlineError = null;
    const nextTags = currentTags.filter((_, candidateIndex) => candidateIndex !== index);
    setTags(nextTags);
  }

  function focusAfterRemove(index: number): void {
    if (index > 0) {
      void focusChip(index - 1);
      return;
    }

    focusedChipIndex = -1;
    void focusInput();
  }

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    if (resolvedReadonly) {
      target.value = draftValue;
      return;
    }
    draftValue = target.value;
    inlineError = null;
    consumerInput?.(event as Event & { currentTarget: EventTarget & HTMLInputElement });
  }

  function handleInputFocus(event: FocusEvent): void {
    focusedChipIndex = -1;
    consumerFocus?.(event as FocusEvent & { currentTarget: EventTarget & HTMLInputElement });
  }

  function handleInputBlur(event: FocusEvent): void {
    consumerBlur?.(event as FocusEvent & { currentTarget: EventTarget & HTMLInputElement });
  }

  function handleInputKeydown(event: KeyboardEvent): void {
    if (!resolvedDisabled && !resolvedReadonly) {
      const input = event.currentTarget as HTMLInputElement;
      const candidate = draftValue.trim();
      const delimiterMatch = matchesDelimiter(event.key);

      if (!event.isComposing && event.key === 'Enter' && candidate.length > 0) {
        event.preventDefault();
        commitDraft();
      } else if (!event.isComposing && delimiterMatch) {
        event.preventDefault();
        commitDraft();
      } else if (
        event.key === 'Backspace' &&
        draftValue === '' &&
        currentTags.length > 0 &&
        !event.defaultPrevented
      ) {
        event.preventDefault();
        void focusChip(currentTags.length - 1);
      } else if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        draftValue === '' &&
        input.selectionStart === 0 &&
        input.selectionEnd === 0 &&
        currentTags.length > 0
      ) {
        event.preventDefault();
        void focusChip(currentTags.length - 1);
      }
    }

    consumerKeyDown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement });
  }

  function handleChipFocus(index: number): void {
    focusedChipIndex = index;
  }

  function handleChipClick(index: number): void {
    focusedChipIndex = index;
    void focusChip(index);
  }

  function handleChipKeydown(index: number, event: KeyboardEvent): void {
    if (resolvedDisabled || resolvedReadonly) return;

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeTag(index);
      focusAfterRemove(index);
    } else if (isRovingKey(event.key)) {
      const nextIndex = handleRovingKeydown(event, index, currentTags.length, {
        horizontal: true,
        vertical: false,
      });

      if (nextIndex !== null) {
        event.preventDefault();
        if (event.key === 'ArrowRight' && index === currentTags.length - 1) {
          focusedChipIndex = -1;
          void focusInput();
        } else {
          void focusChip(nextIndex);
        }
      }
    }
  }
</script>

<div
  bind:this={rootElement}
  class={classNames('cinder-tag-input', className)}
  data-disabled={resolvedDisabled ? '' : undefined}
  data-invalid={isInvalid ? '' : undefined}
>
  <div class="cinder-tag-input__control" data-disabled={resolvedDisabled ? '' : undefined}>
    <ul
      id={listboxId}
      class="cinder-tag-input__listbox"
      role="listbox"
      aria-multiselectable="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
    >
      {#each currentTags as tag, index (`${index}:${tag}`)}
        <li
          class="cinder-tag-input__chip"
          role="option"
          aria-selected="true"
          tabindex={focusedChipIndex === index ? 0 : -1}
          onfocus={() => {
            handleChipFocus(index);
          }}
          onclick={() => {
            handleChipClick(index);
          }}
          onkeydown={(event) => {
            handleChipKeydown(index, event);
          }}
        >
          <span class="cinder-tag-input__chip-label">{tag}</span>
          <button
            type="button"
            class="cinder-tag-input__remove"
            tabindex="-1"
            aria-label={`Remove ${tag}`}
            disabled={resolvedDisabled || resolvedReadonly}
            onclick={(event) => {
              event.stopPropagation();
              removeTag(index);
              focusAfterRemove(index);
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </li>
      {/each}
    </ul>

    <input
      bind:this={inputElement}
      {...rest}
      id={resolvedId}
      type="text"
      class="cinder-tag-input__input"
      value={draftValue}
      readonly={resolvedReadonly}
      disabled={resolvedDisabled}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={resolvedAriaInvalid}
      aria-required={resolvedRequired ? 'true' : undefined}
      oninput={handleInput}
      onfocus={handleInputFocus}
      onblur={handleInputBlur}
      onkeydown={handleInputKeydown}
    />
  </div>

  {#if inlineError}
    <p id={inlineErrorId} class="cinder-tag-input__error" aria-live="polite">{inlineError}</p>
  {/if}

  {#if name}
    {#each currentTags as tag, index (`hidden:${index}:${tag}`)}
      <input type="hidden" {name} value={tag} />
    {/each}
  {/if}
</div>
