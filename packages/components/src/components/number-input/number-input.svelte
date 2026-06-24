<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Numeric input with locale-aware formatting, min and max bounds, and step increments emitting a number or null.
   * @tag form
   * @tag numeric
   * @useWhen Collecting a bounded numeric value such as a quantity, price, or age.
   * @useWhen Needing locale-aware display formatting on top of a native number input.
   * @avoidWhen Selecting a value within a continuous range visually — use slider instead.
   * @avoidWhen Collecting free-form text or non-numeric content — use input instead.
   * @related input, slider
   */
  export type { NumberInputProps } from './number-input.types.ts';
</script>

<script lang="ts">
  import type { NumberInputProps } from './number-input.types.ts';
  import { untrack } from 'svelte';

  import { resolveFieldControl } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { formatNumber } from '../../utilities/format-number.ts';
  import { parseLocaleNumber } from '../../utilities/parse-locale-number.ts';

  let {
    id,
    defaultValue = null,
    value = $bindable(null),
    min,
    max,
    step,
    format,
    locale,
    disabled,
    required,
    name,
    label,
    description,
    error,
    class: className,
    onchange,
    'aria-describedby': consumerDescribedBy,
    ...rest
  }: NumberInputProps = $props();

  const context = getFormFieldContext();

  let editorBuffer = $state('');
  let isFocused = $state(false);
  let hasMounted = $state(false);
  let inputElement: HTMLInputElement | undefined = $state();

  $effect(() => {
    hasMounted = true;
  });
  // Two-part internal-invalid surface: malformed (parse failure) and
  // required-empty (no value when the field demands one). Both drive
  // `aria-invalid` so screen readers stay aligned with native validity.
  let malformedError = $state(false);
  let requiredEmptyError = $state(false);

  // Seed the bindable from defaultValue when the parent didn't supply a value.
  // Read untracked: this is a one-time mount seed, not a reactive sync.
  untrack(() => {
    if (value === null && defaultValue !== null) {
      value = defaultValue;
    }
  });

  const resolvedLocale = $derived(locale ?? (hasMounted ? navigator.language : 'en-US'));

  const resolvedMin = $derived(typeof min === 'number' && Number.isFinite(min) ? min : -Infinity);
  const resolvedMax = $derived(typeof max === 'number' && Number.isFinite(max) ? max : Infinity);

  const isValidStep = (s: unknown): s is number =>
    typeof s === 'number' && Number.isFinite(s) && s > 0;

  const incrementStep = $derived(isValidStep(step) ? step : 1);
  const snapStep = $derived(isValidStep(step) ? step : null);

  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  function roundToPrecision(n: number, digits: number): number {
    return Number(n.toFixed(Math.min(digits, 12)));
  }

  function fractionalDigits(n: number): number {
    if (!Number.isFinite(n)) return 0;
    const s = String(n);
    if (s.includes('e') || s.includes('E')) {
      const parts = s.toLowerCase().split('e');
      const mantissa = parts[0] ?? '';
      const expStr = parts[1] ?? '0';
      const exp = Number(expStr);
      const fracOfMantissa = mantissa.split('.')[1]?.length ?? 0;
      return Math.max(0, fracOfMantissa - exp);
    }
    return s.split('.')[1]?.length ?? 0;
  }

  // Three commit sources — that's the smallest set that captures the actually-
  // distinct behaviors:
  // - 'delta': user pressed a stepper or arrow/page/home/end — value is already
  //   step-aligned, so snap-to-grid is skipped. onchange fires.
  // - 'typed': user committed via blur/enter/submit — apply snap-to-grid.
  //   onchange fires unless the source is a serialization-only event.
  // - 'reset': form reset — like typed in that snap doesn't apply (we're
  //   restoring defaultValue verbatim), but always fires onchange.
  type CommitSource = 'typed' | 'delta' | 'reset';

  /**
   * Apply the value to component state and side-effects: native validity,
   * onchange callback, and the bindable `value` write. Returns the value that
   * was actually applied so callers can chain.
   */
  function commit(
    next: number | null,
    parseStatus: 'valid' | 'empty' | 'malformed',
    emitChange: boolean,
  ): number | null {
    const nextMalformed = !resolvedDisabled && parseStatus === 'malformed';
    const nextRequiredEmpty =
      !resolvedDisabled && !nextMalformed && resolvedRequired && next === null;

    if (inputElement) {
      if (nextMalformed) {
        inputElement.setCustomValidity('Please enter a valid number.');
      } else if (nextRequiredEmpty) {
        inputElement.setCustomValidity('Please enter a number.');
      } else {
        inputElement.setCustomValidity('');
      }
    }

    malformedError = nextMalformed;
    requiredEmptyError = nextRequiredEmpty;

    if (!Object.is(next, value)) {
      isInternalValueChange = true;
      value = next;
    }

    if (emitChange) {
      onchange?.(next);
    }

    return next;
  }

  /**
   * Commit a numeric value. For `'typed'` sources the value is snapped to the
   * step grid (if `step` is set), then clamped. For `'delta'` and `'reset'`
   * sources the value is only clamped.
   */
  function commitFromNumber(
    source: CommitSource,
    raw: number | null,
    parseStatus: 'valid' | 'empty' | 'malformed' = 'valid',
  ): number | null {
    if (raw === null) return commit(null, parseStatus, true);
    if (!Number.isFinite(raw)) return commit(null, 'malformed', true);
    let result = raw;
    if (source === 'typed' && snapStep !== null) {
      const origin = Number.isFinite(resolvedMin) ? resolvedMin : 0;
      result = origin + Math.round((raw - origin) / snapStep) * snapStep;
      result = roundToPrecision(result, fractionalDigits(snapStep));
    } else if (source === 'delta' && snapStep !== null) {
      // Eliminate float accumulation noise (0.1 + 0.2 → 0.30000…) while
      // preserving base-value precision that exceeds the step's precision
      // (value=0.5 + step=1 → 1.5, not 2). First clamp at 12 digits to get a
      // clean representation, then take the max of step digits and the clean
      // result's digits as the final rounding target.
      const cleanRaw = roundToPrecision(raw, 12);
      result = roundToPrecision(
        raw,
        Math.max(fractionalDigits(snapStep), fractionalDigits(cleanRaw)),
      );
    }
    const clamped = Math.min(resolvedMax, Math.max(resolvedMin, result));
    return commit(clamped, parseStatus, true);
  }

  /**
   * Commit by parsing user-typed text via the locale parser, then routing the
   * canonical numeric value through `commitFromNumber`.
   */
  function commitFromText(source: CommitSource, text: string): number | null {
    const result = parseLocaleNumber(text, resolvedLocale, format);
    if (result.status !== 'valid') {
      return commit(null, result.status, true);
    }
    const canonical =
      format?.style === 'percent'
        ? roundToPrecision(result.value / 100, Math.max(2, fractionalDigits(result.value) + 2))
        : result.value;
    return commitFromNumber(source, canonical, 'valid');
  }

  // Track value changes initiated from within the component so the "parent
  // always wins during focus" effect below doesn't fight a commit. Reactive
  // because two distinct $effects read it across the same flush.
  let isInternalValueChange = $state(false);

  // Set to true by the Enter key handler immediately before requestSubmit() so
  // the capture-phase submit listener knows the value was already flushed and
  // can skip the redundant commitFromText call (preventing double onchange).
  let enterKeyFlushed = false;

  // formattedValue and displayValue collapsed into one derived expression.
  // When the last commit was malformed we keep the user's typed text visible
  // so they can correct it instead of having their input erased.
  const displayValue = $derived(
    isFocused
      ? editorBuffer
      : malformedError
        ? editorBuffer
        : value === null || value === undefined
          ? ''
          : formatNumber(value, resolvedLocale, format),
  );

  // Parent always wins: when `value` changes from outside while focused,
  // replace the in-progress editor buffer with a fresh edit-display. We use
  // `$derived` to capture only the value/locale/format inputs (not
  // `isFocused`) so re-focusing after a malformed blur doesn't accidentally
  // clobber the user's typed text. The effect that consumes this derived
  // only writes to `editorBuffer` when the underlying value actually changes.
  const parentValueSignature = $derived(
    `${value ?? ''}|${resolvedLocale}|${JSON.stringify(format ?? null)}`,
  );
  let lastSeenParentSignature = untrack(() => parentValueSignature);
  $effect(() => {
    const signature = parentValueSignature;
    if (signature === lastSeenParentSignature) return;
    lastSeenParentSignature = signature;
    if (isInternalValueChange) {
      isInternalValueChange = false;
      return;
    }
    if (!isFocused) return;
    editorBuffer = value === null || value === undefined ? '' : buildEditDisplay(value);
  });

  // Validity-sync for required/disabled changes outside the commit path. Also
  // clears the malformed flag whenever value flips to a defined number from
  // outside the component — the parent assigning a valid number means the
  // input is no longer in a parse-failure state. Keeps required-empty validity
  // in lockstep with the `requiredEmptyError` flag so aria-invalid and native
  // validity never diverge.
  $effect(() => {
    if (!inputElement) return;
    if (resolvedDisabled) {
      inputElement.setCustomValidity('');
      malformedError = false;
      requiredEmptyError = false;
    } else if (value !== null && value !== undefined && !isInternalValueChange) {
      // External value write — clear all prior validity state.
      malformedError = false;
      requiredEmptyError = false;
      inputElement.setCustomValidity('');
    } else if (malformedError) {
      // commit() owns the malformed message; leave it in place.
    } else if (!isFocused && resolvedRequired && (value === null || value === undefined)) {
      inputElement.setCustomValidity('Please enter a number.');
      requiredEmptyError = true;
    } else if (isFocused && requiredEmptyError) {
      // User is actively typing — suppress the required-empty error so we don't
      // flash "Please enter a number." in the aria-live region mid-keystroke.
      inputElement.setCustomValidity('');
      requiredEmptyError = false;
    } else if (value !== null && value !== undefined) {
      inputElement.setCustomValidity('');
      requiredEmptyError = false;
    }
  });

  function buildEditDisplay(v: number): string {
    const editFormat: Intl.NumberFormatOptions = {
      ...format,
      style: 'decimal',
      useGrouping: false,
      currency: undefined,
      currencyDisplay: undefined,
      notation: 'standard',
      compactDisplay: undefined,
    };
    if (format?.style === 'percent') {
      const asPercent = roundToPrecision(v * 100, 12);
      return formatNumber(asPercent, resolvedLocale, editFormat);
    }
    return formatNumber(v, resolvedLocale, editFormat);
  }

  function canonicalValueFromText(text: string): number | undefined {
    const result = parseLocaleNumber(text, resolvedLocale, format);
    if (result.status !== 'valid') return undefined;
    const canonical =
      format?.style === 'percent'
        ? roundToPrecision(result.value / 100, Math.max(2, fractionalDigits(result.value) + 2))
        : result.value;
    return Number.isFinite(canonical) ? canonical : undefined;
  }

  const resolvedAriaValueNow = $derived(
    isFocused ? canonicalValueFromText(editorBuffer) : (value ?? undefined),
  );

  function onFocus() {
    // Preserve the editor buffer when re-focusing after a malformed blur so
    // the user can correct their own text instead of having it disappear.
    if (!malformedError) {
      editorBuffer = value === null || value === undefined ? '' : buildEditDisplay(value);
    }
    isFocused = true;
  }

  function onBlur(event: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
    const buffered = editorBuffer;
    isFocused = false;
    commitFromText('typed', buffered);
    rest.onblur?.(event);
  }

  function onInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    editorBuffer = event.currentTarget.value;
    // Clear any prior malformed state as soon as the user starts re-typing —
    // and clear the matching native customValidity message so aria-invalid
    // and `input.validity.customError` move together.
    if (malformedError) {
      malformedError = false;
      inputElement?.setCustomValidity('');
    }
  }

  function getBaseForStep(direction: 'increment' | 'decrement'): number {
    const parsed = isFocused ? parseLocaleNumber(editorBuffer, resolvedLocale, format) : null;
    let baseFromDisplay: number | null = null;
    if (parsed && parsed.status === 'valid') {
      baseFromDisplay =
        format?.style === 'percent'
          ? roundToPrecision(parsed.value / 100, Math.max(2, fractionalDigits(parsed.value) + 2))
          : parsed.value;
    }
    const defaultStart =
      direction === 'increment'
        ? Number.isFinite(resolvedMin)
          ? resolvedMin
          : 0
        : Number.isFinite(resolvedMax)
          ? resolvedMax
          : 0;
    return baseFromDisplay ?? value ?? defaultStart;
  }

  function stepBy(direction: 'increment' | 'decrement', multiplier = 1) {
    const base = getBaseForStep(direction);
    const delta = incrementStep * multiplier * (direction === 'increment' ? 1 : -1);
    const next = commitFromNumber('delta', base + delta);
    // Keep the in-progress editor buffer in sync with the committed value
    // when focused. Without this, repeated ArrowUp / ArrowDown steps would
    // step off the stale buffer instead of the canonical value.
    if (isFocused) {
      editorBuffer = next === null ? '' : buildEditDisplay(next);
    }
    inputElement?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (resolvedDisabled) return;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        stepBy('increment');
        break;
      case 'ArrowDown':
        event.preventDefault();
        stepBy('decrement');
        break;
      case 'PageUp':
        event.preventDefault();
        stepBy('increment', 10);
        break;
      case 'PageDown':
        event.preventDefault();
        stepBy('decrement', 10);
        break;
      case 'Home':
        if (Number.isFinite(resolvedMin)) {
          event.preventDefault();
          const homeNext = commitFromNumber('delta', resolvedMin);
          if (isFocused) editorBuffer = homeNext === null ? '' : buildEditDisplay(homeNext);
        }
        break;
      case 'End':
        if (Number.isFinite(resolvedMax)) {
          event.preventDefault();
          const endNext = commitFromNumber('delta', resolvedMax);
          if (isFocused) editorBuffer = endNext === null ? '' : buildEditDisplay(endNext);
        }
        break;
      case 'Enter': {
        event.preventDefault();
        commitFromText('typed', isFocused ? editorBuffer : '');
        const form = inputElement?.closest('form');
        if (form) {
          if (form.checkValidity()) {
            enterKeyFlushed = true;
            form.requestSubmit();
          } else {
            form.reportValidity();
          }
        }
        break;
      }
    }
  }

  // Form integration: submit-capture to flush any in-flight edit so the hidden
  // input carries the user's just-typed value at serialization time. The hidden
  // input is the sole form-data path — there is no `formdata` listener that
  // duplicates the serialization (avoiding double-write surprises when the
  // hidden input and a listener disagree).
  $effect(() => {
    if (!inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onSubmit = () => {
      // Capture-phase listener: runs before any consumer-registered submit
      // handler, so by the time `new FormData(form)` is collected (whether
      // by the platform's submission machinery or by app code in a later
      // listener) the hidden input already reflects the canonical value.
      // Validity reporting lives in onKeyDown / native form submission —
      // not here — so the listener has exactly one job: flush.
      if (resolvedDisabled) return;
      // Skip flush when Enter already committed — avoids double onchange.
      if (enterKeyFlushed) {
        enterKeyFlushed = false;
        return;
      }
      if (isFocused) commitFromText('typed', editorBuffer);
    };
    const onReset = () => {
      if (resolvedDisabled) return;
      commitFromNumber('reset', defaultValue ?? null, defaultValue === null ? 'empty' : 'valid');
    };

    form.addEventListener('submit', onSubmit, true);
    form.addEventListener('reset', onReset);

    return () => {
      form.removeEventListener('submit', onSubmit, true);
      form.removeEventListener('reset', onReset);
    };
  });

  // Internal error region — rendered when the parse failed and the consumer
  // didn't supply their own `error` text. Without it, screen readers would
  // hear `aria-invalid="true"` with no associated message describing why.
  const internalErrorMessage = $derived(
    !error && malformedError
      ? 'Please enter a valid number.'
      : !error && requiredEmptyError
        ? 'Please enter a number.'
        : null,
  );
  const internalErrorId = $derived(internalErrorMessage ? `${id}-internal-error` : undefined);

  // `hasError` is scoped to the consumer's `error` text (which drives the
  // rendered error <p> and its id). The broader invalid surface — internal
  // parse failure or required-empty — is fed through `consumerInvalid` so it
  // sets aria-invalid without fabricating an error-element id that points at
  // nothing. The internal message is wired into describedBy via its own id.
  const internalInvalid = $derived(malformedError || requiredEmptyError ? 'true' : undefined);
  const field = $derived(
    resolveFieldControl({
      id,
      generatedId: id,
      context,
      hasDescription: !!description,
      hasError: !!error,
      localIdNamespace: 'number-input',
      consumerDescribedBy,
      consumerInvalid: internalInvalid ?? (rest['aria-invalid'] as 'true' | 'false' | undefined),
      additionalDescribedBy: [internalErrorId],
      required,
      disabled,
    }),
  );
  const ownDescriptionId = $derived(field.ownDescriptionId);
  const ownErrorId = $derived(field.ownErrorId);
  const describedBy = $derived(field.describedBy);
  const resolvedAriaInvalid = $derived(field.ariaInvalid);

  const incrementDisabled = $derived(
    resolvedDisabled || (value !== null && value !== undefined && value >= resolvedMax),
  );
  const decrementDisabled = $derived(
    resolvedDisabled || (value !== null && value !== undefined && value <= resolvedMin),
  );

  const showHiddenInput = $derived(
    typeof name === 'string' && name.length > 0 && !resolvedDisabled,
  );

  // Compose stepper labels with the field's label (when present) and the
  // current step magnitude. Screen-reader users navigating between multiple
  // number fields then hear distinguishable, magnitude-aware names.
  const stepperLabelSuffix = $derived(
    label ? ` ${label} by ${incrementStep}` : ` by ${incrementStep}`,
  );
</script>

<div class={classNames('cinder-input-field', className)}>
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={resolvedDisabled || undefined}>
      {label}
      {#if resolvedRequired}
        <span class="cinder-_required-marker" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  <div class="cinder-number-input" data-disabled={resolvedDisabled ? '' : undefined}>
    <input
      bind:this={inputElement}
      {id}
      type="text"
      role="spinbutton"
      inputmode="decimal"
      value={displayValue}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      class="cinder-input cinder-number-input__input"
      {...rest}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={describedBy}
      aria-valuenow={resolvedAriaValueNow}
      aria-valuemin={Number.isFinite(resolvedMin) ? resolvedMin : undefined}
      aria-valuemax={Number.isFinite(resolvedMax) ? resolvedMax : undefined}
      oninput={onInput}
      onfocus={onFocus}
      onblur={onBlur}
      onkeydown={onKeyDown}
    />
    <button
      type="button"
      class="cinder-number-input__stepper cinder-number-input__stepper--increment"
      aria-label={`Increment${stepperLabelSuffix}`}
      disabled={incrementDisabled}
      tabindex="-1"
      onclick={() => stepBy('increment')}
    >
      <span aria-hidden="true">+</span>
    </button>
    <button
      type="button"
      class="cinder-number-input__stepper cinder-number-input__stepper--decrement"
      aria-label={`Decrement${stepperLabelSuffix}`}
      disabled={decrementDisabled}
      tabindex="-1"
      onclick={() => stepBy('decrement')}
    >
      <span aria-hidden="true">&#x2212;</span>
    </button>
  </div>

  {#if showHiddenInput}
    <input
      type="hidden"
      {name}
      value={value === null || value === undefined ? '' : String(value)}
    />
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-input-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-input-field__error" aria-live="polite">{error}</p>
  {:else if internalErrorMessage}
    <p id={internalErrorId} class="cinder-input-field__error" aria-live="polite">
      {internalErrorMessage}
    </p>
  {/if}
</div>
