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
  import { tick, untrack } from 'svelte';

  import { devWarn } from '../../utilities/dev-warn.ts';

  import {
    ariaInvalid,
    composeDescribedBy,
    resolveFieldControl,
  } from '../../_internal/field-control.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { handleRovingKeydown, isRovingKey } from '../../utilities/roving-tabindex.ts';
  import type { TagInputProps } from './tag-input.types.ts';

  const generatedId = $props.id();

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
    'aria-invalid': consumerInvalid,
    required: _ignoredRequired,
    onchange,
    ...rest
  }: TagInputProps & {
    required?: boolean;
  } = $props();

  const initialDefaultTags = untrack(() => [...(defaultValue ?? [])]);

  const context = getFormFieldContext();

  let rootElement = $state<HTMLDivElement | null>(null);
  let inputElement = $state<HTMLInputElement | null>(null);
  let draftValue = $state('');
  let inlineError = $state<string | null>(null);
  let uncontrolledTags = $state(initialDefaultTags);
  let focusedChipIndex = $state(-1);
  let statusAnnouncement = $state('');

  const isControlled = $derived(value !== undefined);
  const currentTags = $derived(isControlled ? (value ?? []) : uncontrolledTags);
  const resolvedReadonly = $derived(readonly === true);

  // Base field-control wiring: id, disabled, required, and context-provided
  // describedBy resolved from props + FormField context.
  const field = $derived(
    resolveFieldControl({
      ...(id !== undefined ? { id } : {}),
      generatedId,
      context,
      hasDescription: false,
      hasError: false,
      consumerDescribedBy,
      consumerInvalid,
      disabled,
    }),
  );
  const resolvedId = $derived(field.id);
  const tagListId = $derived(`${resolvedId}-tags`);
  const inlineErrorId = $derived(`${resolvedId}-inline-error`);

  // Roving tabindex: exactly one remove button is in the tab order at a time.
  // When a chip is focused it owns the tab stop; otherwise the FIRST chip's
  // button does, so a Tab-only user can always reach the tag list (the keyboard
  // counterpart to the pointer/voice affordance the button provides).
  //
  // Clamp to the live tag count: with no tags there is no tab stop (-1), and a
  // stale focusedChipIndex (e.g. after a controlled value shrinks) is pulled
  // back into range — without this, every button could end up tabindex="-1" and
  // the tag list would become Tab-unreachable.
  const rovingChipIndex = $derived(
    currentTags.length === 0
      ? -1
      : Math.min(focusedChipIndex === -1 ? 0 : focusedChipIndex, currentTags.length - 1),
  );
  const resolvedMax = $derived(
    Number.isFinite(max) ? Math.max(0, Math.floor(max as number)) : undefined,
  );
  // Memoize the delimiter matcher: a RegExp delimiter only changes when the prop
  // changes, so build the expression once here instead of allocating a new
  // RegExp on every keydown. Both the global (g) and sticky (y) flags are stripped
  // because they make `.test()` stateful (it advances/reads `lastIndex`), which would
  // make repeated calls on the memoized instance return inconsistent results.
  const delimiterExpression = $derived(
    typeof delimiter === 'string'
      ? null
      : new RegExp(delimiter.source, delimiter.flags.replaceAll('g', '').replaceAll('y', '')),
  );
  const labelledBy = $derived(composeDescribedBy(context?.labelId, consumerAriaLabelledBy));
  const ariaLabel = $derived(
    labelledBy ? undefined : consumerAriaLabel?.trim() ? consumerAriaLabel : undefined,
  );
  // Compose aria-describedby: field wiring (context description + error) plus the
  // inline validation error id when one is active.
  const describedBy = $derived(
    composeDescribedBy(field.describedBy, inlineError ? inlineErrorId : undefined),
  );
  // aria-invalid: prefer the inline validation error over the context/consumer value.
  const resolvedAriaInvalid = $derived(inlineError ? ariaInvalid(true) : field.ariaInvalid);
  const isInvalid = $derived(resolvedAriaInvalid === 'true');

  $effect(() => {
    if (context && id && context.controlId !== id) {
      devWarn(
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
    if (!inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onReset = () => {
      draftValue = '';
      inlineError = null;
      focusedChipIndex = -1;
      if (!isControlled) {
        uncontrolledTags = [...initialDefaultTags];
      }
    };

    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  });

  function getChipElements(): HTMLElement[] {
    // The focusable, keyboard-removable element is the remove <button> — the
    // <li> chip itself is a non-interactive listitem. Roving tabindex and the
    // Backspace/Delete/arrow handlers all live on the button.
    return Array.from(
      rootElement?.querySelectorAll<HTMLElement>('.cinder-tag-input__remove') ?? [],
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
    return delimiterExpression?.test(key) ?? false;
  }

  function commitDraft(): boolean {
    if (field.disabled || resolvedReadonly) return false;
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
    statusAnnouncement = `${candidate} added.`;
    return true;
  }

  function removeTag(index: number): void {
    if (field.disabled || resolvedReadonly) return;
    inlineError = null;
    const removed = currentTags[index] ?? '';
    const nextTags = currentTags.filter((_, candidateIndex) => candidateIndex !== index);
    setTags(nextTags);
    if (removed) statusAnnouncement = `${removed} removed.`;
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
    if (!field.disabled && !resolvedReadonly) {
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

  function handleChipKeydown(index: number, event: KeyboardEvent): void {
    if (field.disabled || resolvedReadonly) return;

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
  data-disabled={field.disabled ? '' : undefined}
  data-invalid={isInvalid ? '' : undefined}
>
  <div class="cinder-tag-input__control" data-disabled={field.disabled ? '' : undefined}>
    <!-- Committed tags are confirmed VALUES with a per-item "remove" command,
         not selectable options — so this is a plain list (implicit role="list"
         / "listitem"), NOT a role="listbox". A listbox would force every child
         to be a role="option", which legally cannot contain the interactive
         remove <button> (aria-required-children + nested-interactive). As a
         list, the remove <button> is a fully valid, named, focusable control
         reachable by keyboard, pointer, voice control, and switch access. The
         button carries the roving tabindex; arrow keys move between buttons and
         Backspace/Delete removes the focused tag. -->
    <ul
      id={tagListId}
      class="cinder-tag-input__listbox"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
    >
      <!-- Always key by a position-qualified composite (index:tag). A controlled
           `value` prop can contain duplicate strings even when allowDuplicates is
           false, so a pure value key would throw each_key_duplicate. -->
      {#each currentTags as tag, index (`${index}:${tag}`)}
        <li class="cinder-tag-input__chip">
          <span class="cinder-tag-input__chip-label">{tag}</span>
          {#if !field.disabled && !resolvedReadonly}
            <button
              type="button"
              class="cinder-tag-input__remove"
              aria-label={`Remove ${tag}`}
              tabindex={rovingChipIndex === index ? 0 : -1}
              onfocus={() => {
                handleChipFocus(index);
              }}
              onclick={(event) => {
                event.stopPropagation();
                removeTag(index);
                focusAfterRemove(index);
              }}
              onkeydown={(event) => {
                handleChipKeydown(index, event);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          {/if}
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
      disabled={field.disabled}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={resolvedAriaInvalid}
      aria-required={field.required ? 'true' : undefined}
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
      <input type="hidden" {name} value={tag} disabled={field.disabled} />
    {/each}
  {/if}
  <VisuallyHiddenLiveRegion message={statusAnnouncement} />
</div>
