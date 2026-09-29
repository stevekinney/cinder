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
  import { flushSync, tick, untrack } from 'svelte';

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
    value = $bindable<string[]>([]),
    delimiter = ',',
    max,
    validate,
    duplicateValuesAllowed = false,
    commitOnSubmit = false,
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
    onValueChange,
    ...rest
  }: TagInputProps & {
    /**
     * Accepted for prop-shape compatibility with other form controls'
     * `required` prop and intentionally ignored — TagInput does not enforce
     * native constraint validation. Set `required` on the wrapping
     * `<FormField>` instead; that context flows through to this component's
     * `aria-required` wiring via `resolveFieldControl`.
     */
    required?: boolean;
  } = $props();

  const resetTarget = untrack(() => [...(value ?? [])]);

  const context = getFormFieldContext();

  let rootElement = $state<HTMLDivElement | null>(null);
  let inputElement = $state<HTMLInputElement | null>(null);
  let draftValue = $state('');
  let inlineError = $state<string | null>(null);
  let focusedChipId = $state<string | null>(null);
  let statusAnnouncement = $state('');
  // Bumped on every announce so the live region re-fires even when two consecutive
  // announcements share the same text (e.g. adding the same tag again) — a same-value
  // `$state` assignment is a no-op in Svelte 5 and would otherwise be swallowed.
  let statusAnnouncementSequence = $state(0);

  function announceStatus(announcement: string): void {
    statusAnnouncement = announcement;
    statusAnnouncementSequence += 1;
  }

  const currentTags = $derived(value ?? []);
  const resolvedReadonly = $derived(readonly === true);

  // Stable per-occurrence chip identity. `currentTags` only carries tag
  // *values* — a controlled `value` update (insert, remove, reorder) gives us
  // a brand-new array with no positional relationship to the last one, so
  // `${index}:${tag}` keys (the old scheme) reassign a chip's DOM node/focus
  // to whatever tag now lands on that index. Assigning a durable id per
  // occurrence, reused by value in left-to-right order, keeps the "same"
  // logical chip attached to the same DOM node across such updates.
  //
  // `occurrenceIds` holds, after each reconciliation, the queue of ids
  // currently assigned to each tag value in appearance order — the source
  // queue the *next* reconciliation consumes from. It is plain (untracked)
  // bookkeeping, not `$state`: `tagIds` is the reactive, render-facing output.
  let occurrenceIds = new Map<string, string[]>();
  let nextOccurrenceId = 0;

  function mintOccurrenceId(): string {
    nextOccurrenceId += 1;
    return `tag-${nextOccurrenceId}`;
  }

  function reconcileTagIds(tags: string[]): string[] {
    const previousQueues = occurrenceIds;
    const nextQueues = new Map<string, string[]>();
    const ids: string[] = [];

    for (const tag of tags) {
      const queue = previousQueues.get(tag);
      const occurrenceId = queue && queue.length > 0 ? queue.shift()! : mintOccurrenceId();
      ids.push(occurrenceId);
      const bucket = nextQueues.get(tag);
      if (bucket) {
        bucket.push(occurrenceId);
      } else {
        nextQueues.set(tag, [occurrenceId]);
      }
    }

    occurrenceIds = nextQueues;
    return ids;
  }

  // Recomputed synchronously with `currentTags` (a `$derived`, not an
  // `$effect`) so the `{#each}` keys below are always in sync with the tags
  // they key — there is never a render where `currentTags` has moved on but
  // `tagIds` has not caught up yet.
  const tagIds = $derived.by(() => reconcileTagIds(currentTags));

  // Flags that the write about to land in `value` came from this component's
  // own `setTags` (a commit or a user-driven removal), not from a parent
  // rewriting a controlled `value` prop. Both look identical to `currentTags`
  // by the time the reconciliation effect below runs — and comparing the
  // written array by reference does not work here, since `value`/`currentTags`
  // are Svelte 5 reactive state and reading them back yields a proxied
  // wrapper, never the exact array instance that was assigned — so a plain
  // synchronous flag set immediately before the assignment (and consumed by
  // the very next reconciliation pass) is the mechanism used to tell them
  // apart. An internal write is already followed by its own explicit,
  // index-based focus call (e.g. `focusAfterRemove`); the id-survival
  // fallback below exists only for the parent-driven case, which owns no such
  // follow-up.
  let pendingInternalWrite = false;

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

  // Translate the id-based focus back to an index for the roving-tabindex
  // math below, which still operates on positions.
  const focusedChipIndex = $derived(focusedChipId === null ? -1 : tagIds.indexOf(focusedChipId));

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
    if (_ignoredRequired && !context?.required) {
      devWarn(
        "[cinder/TagInput] ignores the native 'required' prop; set required on the wrapping FormField instead.",
      );
    }
  });

  // Id-survival focus reconciliation. Runs whenever the reconciled id list
  // changes (any insert, remove, or reorder of `currentTags`), replacing the
  // old numeric clamp (`focusedChipIndex >= currentTags.length`) with an
  // identity check: has the chip `focusedChipId` names actually disappeared?
  //
  // Uses `$effect.pre`, which runs before Svelte patches the DOM, so
  // `document.activeElement` still reports the *about-to-be-replaced* chip
  // button here — after the patch, a removed button has already lost focus
  // to `<body>` and this check could never observe it.
  $effect.pre(() => {
    // Re-run whenever the reconciled id list changes.
    void tagIds;

    // Consume the flag: only the reconciliation pass immediately following a
    // `setTags` call is "internal" — see `pendingInternalWrite` above.
    const isInternalWrite = pendingInternalWrite;
    pendingInternalWrite = false;

    if (focusedChipId === null || tagIds.includes(focusedChipId)) return;

    // The chip that held `focusedChipId` no longer exists in the reconciled
    // list. Read real DOM focus BEFORE Svelte removes that chip's button.
    const activeElement = document.activeElement;
    const chipHadRealFocus =
      activeElement !== null && getChipElements().includes(activeElement as HTMLElement);

    focusedChipId = null;

    // `removeTag` + `focusAfterRemove` already own focus for user-driven
    // deletions (an internal `setTags` write, immediately followed by their
    // own index-based `focusChip`/`focusInput` call). Moving focus here too
    // would race with — and could override — that explicit call, so internal
    // writes skip the fallback entirely.
    if (isInternalWrite) return;

    // Only steal focus toward the input if a chip button actually held real
    // DOM focus; a stale-but-unfocused id disappearing must never move focus
    // away from wherever the user actually is on the page.
    if (chipHadRealFocus) {
      void focusInput();
    }
  });

  $effect(() => {
    if (!inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onSubmit = (event: SubmitEvent) => {
      if (!commitOnSubmit || field.disabled || resolvedReadonly) return;
      if (!draftValue.trim()) return;

      let committed = false;
      flushSync(() => {
        committed = commitDraft();
      });

      if (!committed) {
        event.preventDefault();
      }
    };

    const onReset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        draftValue = '';
        inlineError = null;
        focusedChipId = null;
        value = [...resetTarget];
      });
    };

    form.addEventListener('submit', onSubmit, true);
    form.addEventListener('reset', onReset);
    return () => {
      form.removeEventListener('submit', onSubmit, true);
      form.removeEventListener('reset', onReset);
    };
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
    pendingInternalWrite = true;
    value = normalized;
    onValueChange?.(normalized);
  }

  function validationError(candidate: string): string | null {
    if (resolvedMax !== undefined && currentTags.length >= resolvedMax) {
      return `You can add up to ${resolvedMax} tag${resolvedMax === 1 ? '' : 's'}.`;
    }

    if (!duplicateValuesAllowed && currentTags.some((tag) => tag.trim() === candidate)) {
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
    focusedChipId = null;
    setTags([...currentTags, candidate]);
    announceStatus(`${candidate} added.`);
    return true;
  }

  function removeTag(index: number): void {
    if (field.disabled || resolvedReadonly) return;
    inlineError = null;
    const removed = currentTags[index] ?? '';
    const nextTags = currentTags.filter((_, candidateIndex) => candidateIndex !== index);
    setTags(nextTags);
    if (removed) announceStatus(`${removed} removed.`);
  }

  function focusAfterRemove(index: number): void {
    if (index > 0) {
      void focusChip(index - 1);
      return;
    }

    focusedChipId = null;
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
    focusedChipId = null;
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

  function handleChipFocus(occurrenceId: string): void {
    focusedChipId = occurrenceId;
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
          focusedChipId = null;
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
      <!-- Key by the stable per-occurrence id (see `tagIds` above), not
           position — that is what lets the "same" chip keep its DOM node and
           focus across a controlled `value` insert/remove/reorder. A pure
           value key would still throw each_key_duplicate for a controlled
           `value` containing duplicate strings, which `tagIds` avoids by
           minting a distinct id per occurrence. -->
      {#each currentTags as tag, index (tagIds[index])}
        <li class="cinder-tag-input__chip">
          <span class="cinder-tag-input__chip-label">{tag}</span>
          {#if !field.disabled && !resolvedReadonly}
            <button
              type="button"
              class="cinder-tag-input__remove"
              aria-label={`Remove ${tag}`}
              tabindex={rovingChipIndex === index ? 0 : -1}
              onfocus={() => {
                handleChipFocus(tagIds[index]!);
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
    {#each currentTags as tag, index (`hidden:${tagIds[index]}`)}
      <input type="hidden" {name} value={tag} disabled={field.disabled} />
    {/each}
  {/if}
  <VisuallyHiddenLiveRegion
    message={statusAnnouncement}
    announcementSequence={statusAnnouncementSequence}
  />
</div>
