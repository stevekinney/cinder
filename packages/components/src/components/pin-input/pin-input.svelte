<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Segmented one-time-code input with auto-advance, paste distribution, and masking support for entering short security codes.
   * @tag form
   * @tag otp
   * @useWhen Collecting a short security code such as a one-time password or SMS verification code.
   * @useWhen Letting the browser autofill a one-time-code into a visually segmented control.
   * @avoidWhen Collecting a free-form string of any length — use input instead.
   * @avoidWhen Collecting a numeric value that participates in arithmetic — use number-input instead.
   * @related input, number-input, form-field
   */
  export type { PinInputMode, PinInputProps } from './pin-input.types.ts';
</script>

<script lang="ts">
  import type { PinInputProps } from './pin-input.types.ts';

  import { devWarn } from '../../utilities/dev-warn.ts';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    id,
    value = $bindable(''),
    length = 6,
    mode = 'numeric',
    masked = false,
    label,
    hideLabel = false,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    description,
    error,
    disabled,
    required,
    name,
    autocomplete = 'one-time-code',
    class: className,
    onchange,
  }: PinInputProps = $props();

  const context = getFormFieldContext();

  /** Normalize `length` to an integer in `[1, 12]`, defaulting to 6 on bad input. */
  const normalizedLength = $derived.by(() => {
    if (!Number.isFinite(length)) return 6;
    const truncated = Math.trunc(length);
    if (truncated < 1) return 1;
    if (truncated > 12) return 12;
    return truncated;
  });

  function isAllowedChar(character: string): boolean {
    if (mode === 'numeric') return /^[0-9]$/.test(character);
    return /^[A-Za-z0-9]$/.test(character);
  }

  function filterValue(input: string): string {
    let out = '';
    for (const character of input) {
      if (isAllowedChar(character)) out += character;
      if (out.length >= normalizedLength) break;
    }
    return out;
  }

  // Segments are a pure projection of the bound value: filter to allowed
  // characters, then pad to the normalized length. Every writer (commit,
  // distributeFrom, handleKeyDown) drives `value`, so deriving segments keeps
  // a single source of truth instead of a $state + sync-$effect pair.
  // `normalizedValue` is the canonical form — always filtered and truncated.
  // It is what gets displayed in segments and stored in the hidden input.
  const normalizedValue = $derived(filterValue(value ?? ''));
  const segments = $derived(
    Array.from({ length: normalizedLength }, (_, index) => normalizedValue[index] ?? ''),
  );

  const groupLabelId = $derived(label ? `${id}-label` : undefined);
  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-pin-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-pin-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(error ? ariaInvalid(true) : context?.invalid);
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const resolvedGroupLabelledBy = $derived.by(() => {
    const ids: string[] = [];
    if (groupLabelId) ids.push(groupLabelId);
    else if (context?.labelId) ids.push(context.labelId);
    else if (ariaLabelledBy) ids.push(ariaLabelledBy);
    if (ids.length === 0) return undefined;
    return ids.join(' ');
  });

  const groupAriaLabel = $derived(
    !resolvedGroupLabelledBy && !ariaLabelledBy ? ariaLabel : undefined,
  );

  const hasGroupAccessibleName = $derived(
    !!label || !!context?.labelId || !!ariaLabelledBy || !!ariaLabel,
  );

  $effect(() => {
    if (!hasGroupAccessibleName) {
      devWarn(
        `[cinder/PinInput] No accessible name source for id="${id}". Provide a label, aria-label, aria-labelledby, or wrap in a FormField.`,
      );
    }
  });

  function segmentId(index: number): string {
    return `${id}-segment-${index}`;
  }

  function segmentLabelId(index: number): string {
    return `${id}-segment-${index}-label`;
  }

  /**
   * When a DOM-backed group label exists, segments use `aria-labelledby` that
   * references both the group label and a visually-hidden positional span.
   * When the group's only name source is the consumer's `aria-label`, segments
   * fall back to a computed `aria-label` instead — `aria-labelledby` would
   * override `aria-label`, dropping the consumer's group name.
   */
  function segmentLabelledBy(index: number): string | undefined {
    if (resolvedGroupLabelledBy) {
      return `${resolvedGroupLabelledBy} ${segmentLabelId(index)}`;
    }
    if (ariaLabelledBy) {
      return `${ariaLabelledBy} ${segmentLabelId(index)}`;
    }
    return undefined;
  }

  function segmentAriaLabel(index: number): string | undefined {
    if (resolvedGroupLabelledBy || ariaLabelledBy) return undefined;
    const base = ariaLabel ?? 'Code';
    return `${base} character ${index + 1} of ${normalizedLength}`;
  }

  function commit(nextSegments: string[]): void {
    // Writing `value` re-derives `segments`; no separate segment write needed.
    const joined = nextSegments.join('');
    if (joined !== value) {
      value = joined;
    }
    onchange?.(joined);
  }

  function focusSegment(index: number): void {
    if (typeof document === 'undefined') return;
    const clamped = Math.max(0, Math.min(normalizedLength - 1, index));
    const element = document.getElementById(segmentId(clamped));
    if (element instanceof HTMLInputElement) {
      element.focus();
      element.select();
    }
  }

  function distributeFrom(startIndex: number, rawInput: string): void {
    const filtered = filterValue(rawInput);
    if (filtered.length === 0) return;
    const next = segments.slice();
    let cursor = startIndex;
    for (const character of filtered) {
      if (cursor >= normalizedLength) break;
      next[cursor] = character;
      cursor++;
    }
    commit(next);
    focusSegment(Math.min(cursor, normalizedLength - 1));
  }

  function handleInput(event: Event, index: number): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const rawValue = target.value;
    // Reset the field to whatever segments has — we treat the raw input
    // as the source of new characters via `distributeFrom`.
    if (rawValue.length === 0) {
      const next = segments.slice();
      next[index] = '';
      commit(next);
      return;
    }
    target.value = segments[index] ?? '';
    distributeFrom(index, rawValue);
  }

  function handleKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const current = segments[index] ?? '';
      if (current === '') {
        if (index > 0) {
          const next = segments.slice();
          next[index - 1] = '';
          commit(next);
          focusSegment(index - 1);
          event.preventDefault();
        }
      } else {
        const next = segments.slice();
        next[index] = '';
        commit(next);
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusSegment(index - 1);
      return;
    }
    if (event.key === 'ArrowRight' && index < normalizedLength - 1) {
      event.preventDefault();
      focusSegment(index + 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusSegment(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusSegment(normalizedLength - 1);
      return;
    }
  }

  function handlePaste(event: ClipboardEvent, index: number): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (text.length === 0) return;
    event.preventDefault();
    distributeFrom(index, text);
  }

  const segmentType = $derived(masked ? 'password' : mode === 'numeric' ? 'tel' : 'text');
  const segmentInputMode = $derived<'numeric' | 'text'>(mode === 'numeric' ? 'numeric' : 'text');
</script>

<div
  class={classNames('cinder-pin-input-field', className)}
  data-cinder-disabled={resolvedDisabled || undefined}
>
  {#if label}
    <span
      id={groupLabelId}
      class={classNames('cinder-pin-input-field__label', hideLabel && 'cinder-sr-only')}
      data-disabled={resolvedDisabled || undefined}
    >
      {label}
      {#if resolvedRequired}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </span>
  {/if}

  <!--
    aria-invalid on the role="group" wrapper is a deliberate, tested signal:
    pin-input.test.ts asserts it lives on the group (not the segments, to avoid
    screen-reader double-announcement) with the visible error referenced via
    aria-describedby. ARIA does not list aria-invalid for role=group, so the
    lint rule is a false positive for this documented tradeoff.
  -->
  <!-- svelte-ignore a11y_role_supports_aria_props -->
  <div
    class="cinder-pin-input"
    role="group"
    aria-labelledby={resolvedGroupLabelledBy}
    aria-label={groupAriaLabel}
    aria-describedby={describedBy}
    aria-invalid={resolvedAriaInvalid}
    aria-disabled={resolvedDisabled || undefined}
  >
    {#each Array.from({ length: normalizedLength }, (_, i) => i) as index (index)}
      <span id={segmentLabelId(index)} class="cinder-sr-only">
        Character {index + 1} of {normalizedLength}
      </span>
      <input
        id={segmentId(index)}
        class="cinder-pin-input__segment"
        type={segmentType}
        inputmode={segmentInputMode}
        autocomplete={index === 0 ? autocomplete : 'off'}
        autocapitalize="none"
        spellcheck="false"
        maxlength="1"
        value={segments[index] ?? ''}
        disabled={resolvedDisabled}
        required={resolvedRequired}
        aria-labelledby={segmentLabelledBy(index)}
        aria-label={segmentAriaLabel(index)}
        aria-describedby={describedBy}
        aria-required={resolvedRequired || undefined}
        data-cinder-pin-segment={index}
        oninput={(event) => handleInput(event, index)}
        onkeydown={(event) => handleKeyDown(event, index)}
        onpaste={(event) => handlePaste(event, index)}
      />
    {/each}
  </div>

  {#if name}
    <input
      type="hidden"
      {name}
      value={normalizedValue}
      required={resolvedRequired}
      disabled={resolvedDisabled}
    />
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-pin-input-field__description">
      {description}
    </p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-pin-input-field__error" aria-live="polite" aria-atomic="true">
      {error}
    </p>
  {/if}
</div>
