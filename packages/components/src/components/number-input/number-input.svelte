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
  import { default as Input } from '../input/index.ts';
  import Minus from 'lucide-svelte/icons/minus';
  import Plus from 'lucide-svelte/icons/plus';
  import type { NumberInputProps } from './number-input.types.ts';
  import { untrack } from 'svelte';

  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { formatNumber } from '../../utilities/format-number.ts';
  import { parseLocaleNumber } from '../../utilities/parse-locale-number.ts';
  import {
    createStepController,
    attachInputNode,
    applyCommit,
    fractionalDigits,
    isValidStep,
    normalizeCommitValue,
    roundToPrecision,
    synchronizeValidity,
    toAriaInvalidValue,
    installFormListeners,
    type CommitSource,
    type ParseStatus,
  } from './number-input-logic.svelte.ts';

  let {
    id,
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
    inputAttachment,
    class: className,
    adornment,
    onValueChange,
    onblur: consumerBlur,
    'aria-describedby': consumerDescribedBy,
    ...rest
  }: NumberInputProps = $props();

  const context = getFormFieldContext();
  const localeContext = getLocaleContext();

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

  const resetTarget = untrack(() => value);

  const resolvedLocale = $derived(
    locale ?? localeContext?.locale ?? (hasMounted ? navigator.language : 'en-US'),
  );

  const resolvedMin = $derived(typeof min === 'number' && Number.isFinite(min) ? min : -Infinity);
  const resolvedMax = $derived(typeof max === 'number' && Number.isFinite(max) ? max : Infinity);

  const incrementStep = $derived(isValidStep(step) ? step : 1);
  const snapStep = $derived(isValidStep(step) ? step : null);

  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  // Three commit sources — that's the smallest set that captures the actually-
  // distinct behaviors:
  // - 'delta': user pressed a stepper or arrow/page/home/end — value is already
  //   step-aligned, so snap-to-grid is skipped. onValueChange fires.
  // - 'typed': user committed via blur/enter/submit — apply snap-to-grid.
  //   onValueChange fires unless the source is a serialization-only event.
  // - 'reset': form reset — like typed in that snap doesn't apply (we're
  //   restoring value verbatim), but always fires onValueChange.
  /**
   * Apply the value to component state and side-effects: native validity,
   * onValueChange callback, and the bindable `value` write. Returns the value that
   * was actually applied so callers can chain.
   */
  const commit = (
    next: number | null,
    parseStatus: ParseStatus,
    emitChange: boolean,
  ): number | null =>
    applyCommit(next, parseStatus, emitChange, {
      disabled: resolvedDisabled,
      required: resolvedRequired,
      current: value,
      input: inputElement,
      setMalformed: (nextValue) => {
        malformedError = nextValue;
      },
      setRequiredEmpty: (nextValue) => {
        requiredEmptyError = nextValue;
      },
      markInternal: () => {
        isInternalValueChange = true;
      },
      setValue: (nextValue) => {
        value = nextValue;
      },
      emit: (nextValue) => onValueChange?.(nextValue),
    });

  /**
   * Commit a numeric value. For `'typed'` sources the value is snapped to the
   * step grid (if `step` is set), then clamped. For `'delta'` and `'reset'`
   * sources the value is only clamped.
   */
  function commitFromNumber(
    source: CommitSource,
    raw: number | null,
    parseStatus: ParseStatus = 'valid',
  ): number | null {
    const result = normalizeCommitValue({
      source,
      raw,
      parseStatus,
      min: resolvedMin,
      max: resolvedMax,
      snapStep,
    });
    return commit(result.value, result.parseStatus, true);
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
  // can skip the redundant commitFromText call (preventing double onValueChange).
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
    synchronizeValidity(inputElement, {
      disabled: resolvedDisabled,
      value,
      internalChange: isInternalValueChange,
      focused: isFocused,
      required: resolvedRequired,
      malformed: malformedError,
      requiredEmpty: requiredEmptyError,
      clearErrors: () => {
        malformedError = false;
        requiredEmptyError = false;
      },
      setRequiredEmpty: (nextValue) => {
        requiredEmptyError = nextValue;
      },
    });
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

  function ariaValueNowFromText(text: string): number | undefined {
    const result = parseLocaleNumber(text, resolvedLocale, format);
    if (result.status !== 'valid') return undefined;
    return Number.isFinite(result.value) ? result.value : undefined;
  }

  const resolvedAriaValueNow = $derived(
    isFocused
      ? ariaValueNowFromText(editorBuffer)
      : value === null || value === undefined
        ? undefined
        : format?.style === 'percent'
          ? roundToPrecision(value * 100, 12)
          : value,
  );
  const resolvedAriaValueMin = $derived(
    Number.isFinite(resolvedMin)
      ? format?.style === 'percent'
        ? roundToPrecision(resolvedMin * 100, 12)
        : resolvedMin
      : undefined,
  );
  const resolvedAriaValueMax = $derived(
    Number.isFinite(resolvedMax)
      ? format?.style === 'percent'
        ? roundToPrecision(resolvedMax * 100, 12)
        : resolvedMax
      : undefined,
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
    consumerBlur?.(event);
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

  const stepController = createStepController({
    getValue: () => value,
    getEditorBuffer: () => editorBuffer,
    setEditorBuffer: (next) => {
      editorBuffer = next;
    },
    getFocused: () => isFocused,
    getLocale: () => resolvedLocale,
    getFormat: () => format,
    getMin: () => resolvedMin,
    getMax: () => resolvedMax,
    getStep: () => incrementStep,
    commitNumber: (source, raw) => commitFromNumber(source, raw),
    buildEditDisplay,
    focus: () => inputElement?.focus(),
  });

  function onKeyDown(event: KeyboardEvent) {
    if (resolvedDisabled) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFromText('typed', isFocused ? editorBuffer : '');
      const form = inputElement?.closest('form');
      if (!form) return;
      if (form.checkValidity()) {
        enterKeyFlushed = true;
        form.requestSubmit();
      } else {
        form.reportValidity();
      }
      return;
    }
    stepController.onKeyDown(event);
  }

  $effect(() => {
    if (!inputElement) return;
    return installFormListeners(inputElement, {
      isDisabled: () => resolvedDisabled,
      isFocused: () => isFocused,
      hasEnterKeyFlush: () => enterKeyFlushed,
      clearEnterKeyFlush: () => {
        enterKeyFlushed = false;
      },
      flushSubmit: () => commitFromText('typed', editorBuffer),
      reset: () => commitFromNumber('reset', resetTarget, resetTarget === null ? 'empty' : 'valid'),
    });
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

  const resolvedAriaInvalid = $derived(internalInvalid ?? toAriaInvalidValue(rest['aria-invalid']));

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

  const attachInput = attachInputNode(
    () => inputAttachment,
    (node) => {
      inputElement = node;
    },
  );
</script>

{#snippet steppers()}
  <button
    type="button"
    class="cinder-number-input__stepper cinder-number-input__stepper--increment"
    aria-label={`Increment${stepperLabelSuffix}`}
    disabled={incrementDisabled}
    tabindex="-1"
    onclick={() => stepController.stepBy('increment')}
  >
    <Plus class="cinder-icon-sm" aria-hidden="true" />
  </button>
  <button
    type="button"
    class="cinder-number-input__stepper cinder-number-input__stepper--decrement"
    aria-label={`Decrement${stepperLabelSuffix}`}
    disabled={decrementDisabled}
    tabindex="-1"
    onclick={() => stepController.stepBy('decrement')}
  >
    <Minus class="cinder-icon-sm" aria-hidden="true" />
  </button>
{/snippet}

{#snippet trailingContent()}
  {#if adornment}<span class="cinder-number-input__adornment"
      >{#if typeof adornment === 'string'}{adornment}{:else}{@render adornment()}{/if}</span
    >{/if}
  {@render steppers()}
{/snippet}

<div class={classNames('cinder-input-field', className)} data-cinder-full-width>
  <Input
    {id}
    value={displayValue}
    {...label === undefined ? {} : { label }}
    {...description === undefined ? {} : { description }}
    {...error === undefined ? {} : { error }}
    disabled={resolvedDisabled}
    required={resolvedRequired}
    class="cinder-number-input__input"
    groupClassName="cinder-number-input"
    {...rest}
    type="text"
    role="spinbutton"
    inputmode="decimal"
    inputAttachment={attachInput}
    trailing={trailingContent}
    trailingInteractive
    aria-invalid={resolvedAriaInvalid}
    aria-describedby={[consumerDescribedBy, internalErrorId].filter(Boolean).join(' ') || undefined}
    aria-valuenow={resolvedAriaValueNow}
    aria-valuemin={resolvedAriaValueMin}
    aria-valuemax={resolvedAriaValueMax}
    oninput={onInput}
    onfocus={onFocus}
    onblur={onBlur}
    onkeydown={onKeyDown}
  />

  {#if showHiddenInput}
    <input
      type="hidden"
      {name}
      value={value === null || value === undefined ? '' : String(value)}
    />
  {/if}

  {#if internalErrorMessage}
    <p id={internalErrorId} class="cinder-input-field__error" aria-live="polite">
      {internalErrorMessage}
    </p>
  {/if}
</div>
