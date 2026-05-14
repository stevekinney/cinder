<script lang="ts" module>
  import type { HTMLInputAttributes } from 'svelte/elements';

  export type NumberInputProps = Omit<
    HTMLInputAttributes,
    'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'name' | 'type' | 'oninput' | 'onchange'
  > & {
    id: string;
    value?: number | null;
    defaultValue?: number | null;
    min?: number;
    max?: number;
    step?: number;
    format?: Intl.NumberFormatOptions;
    locale?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    label?: string;
    description?: string;
    error?: string;
    class?: string;
    onchange?: (value: number | null) => void;
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../_internal/field-control.ts';
  import { getFormFieldContext } from '../_internal/form-field-context.ts';
  import { cn } from '../utilities/class-names.ts';
  import { formatNumber } from '../utilities/format-number.ts';

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
    ...rest
  }: NumberInputProps = $props();

  const context = getFormFieldContext();

  let editorBuffer = $state('');
  let isFocused = $state(false);
  let hasMounted = $state(false);
  let inputElement: HTMLInputElement | undefined = $state();
  let resolvedLocale = $state(locale ?? 'en-US');

  // Seed the bindable from defaultValue when the parent didn't supply a value.
  if (value === null && defaultValue !== null && defaultValue !== undefined) {
    value = defaultValue;
  }

  onMount(() => {
    hasMounted = true;
  });

  $effect(() => {
    resolvedLocale = locale ?? (hasMounted ? navigator.language : 'en-US');
  });

  const resolvedMin = $derived(typeof min === 'number' && Number.isFinite(min) ? min : -Infinity);
  const resolvedMax = $derived(typeof max === 'number' && Number.isFinite(max) ? max : Infinity);

  const isValidStep = (s: unknown): s is number =>
    typeof s === 'number' && Number.isFinite(s) && s > 0;

  const incrementStep = $derived(isValidStep(step) ? step : 1);
  const snapStep = $derived<number | null>(isValidStep(step) ? step : null);

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

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  type ParseResult =
    | { value: number; status: 'valid' }
    | { value: null; status: 'empty' | 'malformed' };

  function parseLocaleNumber(
    text: string,
    parseLocale: string,
    fmt: Intl.NumberFormatOptions | undefined,
  ): ParseResult {
    if (text.trim() === '') return { value: null, status: 'empty' };

    let working = text;

    // Localized digit mapping (e.g. ar-EG, hi-IN extended-arabic).
    const digitFormatter = new Intl.NumberFormat(parseLocale, {
      useGrouping: false,
      maximumFractionDigits: 0,
    });
    for (let d = 0; d <= 9; d++) {
      const glyph = digitFormatter.format(d);
      if (glyph !== String(d)) {
        working = working.split(glyph).join(String(d));
      }
    }

    // Separator discovery (always via a plain decimal formatter).
    const sepParts = new Intl.NumberFormat(parseLocale, {
      useGrouping: true,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).formatToParts(-12345.6);
    const groupSep = sepParts.find((p) => p.type === 'group')?.value ?? '';
    const decimalSep = sepParts.find((p) => p.type === 'decimal')?.value ?? '.';

    // Strip caller-format symbols (currency / percent) and any literals from the
    // caller's format — but NOT the locale's digits/separators.
    if (fmt) {
      const callerParts = new Intl.NumberFormat(parseLocale, fmt).formatToParts(0);
      for (const part of callerParts) {
        if (
          part.type === 'currency' ||
          part.type === 'percentSign' ||
          part.type === 'literal' ||
          part.type === 'unit' ||
          part.type === 'compact'
        ) {
          if (part.value) working = working.split(part.value).join('');
        }
      }
    }
    // Always allow a stray percent literal.
    working = working.split('%').join('');

    // Trim whitespace variants.
    working = working.replace(/[\s  ]+/g, (m) => {
      // Keep the locale's narrow-NBSP group separator candidates intact for
      // grouping validation. Only strip them at the very edges.
      return m;
    });
    working = working.replace(/^[\s  ]+|[\s  ]+$/g, '');

    if (working === '') return { value: null, status: 'empty' };

    // Strict grouping validation, only when groupSep appears in the integer part.
    const decimalSplit = working.split(decimalSep);
    if (decimalSplit.length > 2) return { value: null, status: 'malformed' };
    const integerPart = decimalSplit[0] ?? '';
    const fractionPart = decimalSplit[1];

    if (groupSep && integerPart.includes(groupSep)) {
      // Derive group sizes from the locale.
      const probeParts = new Intl.NumberFormat(parseLocale, {
        useGrouping: true,
      }).formatToParts(12345678);
      const integerRuns: string[] = [];
      for (const p of probeParts) {
        if (p.type === 'integer') integerRuns.push(p.value);
      }
      // Right-most run is "primary"; the run just before it is "secondary".
      const primary =
        integerRuns.length > 0 ? (integerRuns[integerRuns.length - 1] ?? '').length : 3;
      const secondary =
        integerRuns.length > 1 ? (integerRuns[integerRuns.length - 2] ?? '').length : primary;
      const groupEsc = escapeRegex(groupSep);
      const grouped = new RegExp(
        `^[+-]?\\d{1,${secondary}}(${groupEsc}\\d{${secondary}})*${groupEsc}\\d{${primary}}$`,
      );
      if (!grouped.test(integerPart)) return { value: null, status: 'malformed' };
    }

    // Strip group separators and normalize decimal.
    let normalized = groupSep.length > 0 ? integerPart.split(groupSep).join('') : integerPart;
    if (fractionPart !== undefined) normalized += '.' + fractionPart;

    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) {
      return { value: null, status: 'malformed' };
    }
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed)) return { value: null, status: 'malformed' };
    return { value: parsed, status: 'valid' };
  }

  type CommitSource =
    | 'blur'
    | 'enter'
    | 'stepper'
    | 'arrow'
    | 'page'
    | 'home'
    | 'end'
    | 'reset'
    | 'formdata'
    | 'submit';

  function shouldEmitChange(source: CommitSource): boolean {
    return source !== 'formdata' && source !== 'submit';
  }

  function commitValue(
    next: number | null,
    source: CommitSource,
    parseStatus: 'valid' | 'empty' | 'malformed',
    formData: FormData | undefined,
  ): number | null {
    if (inputElement) {
      if (disabled) {
        inputElement.setCustomValidity('');
      } else if (parseStatus === 'malformed') {
        inputElement.setCustomValidity('Please enter a valid number.');
      } else if (required && next === null) {
        inputElement.setCustomValidity('Please enter a number.');
      } else {
        inputElement.setCustomValidity('');
      }
    }

    if (formData && typeof name === 'string' && name.length > 0 && !disabled) {
      formData.set(name, next === null ? '' : String(next));
    }

    if (!Object.is(next, value)) {
      value = next;
    }

    if (shouldEmitChange(source)) {
      onchange?.(next);
    }

    return next;
  }

  function commitFromNumber(
    source: CommitSource,
    raw: number | null,
    formData?: FormData,
    parseStatus: 'valid' | 'empty' | 'malformed' = 'valid',
  ): number | null {
    if (raw === null) return commitValue(null, source, parseStatus, formData);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return commitValue(null, source, 'malformed', formData);
    }
    // Snap applies to typed commits (blur/enter/submit/formdata/text-derived).
    // Stepper / arrow / page / home / end deltas are already step-aligned by
    // construction, so re-snapping would push value off the grid the user
    // chose with their explicit ± action.
    const snapApplies =
      snapStep !== null &&
      source !== 'stepper' &&
      source !== 'arrow' &&
      source !== 'page' &&
      source !== 'home' &&
      source !== 'end' &&
      source !== 'reset';
    let snapped = raw;
    if (snapApplies && snapStep !== null) {
      const origin = Number.isFinite(resolvedMin) ? resolvedMin : 0;
      snapped = origin + Math.round((raw - origin) / snapStep) * snapStep;
      snapped = roundToPrecision(snapped, fractionalDigits(snapStep));
    } else if (snapStep !== null) {
      // Even when not snapping, round to step precision so 0.1+0.2 → 0.3 cleanly.
      snapped = roundToPrecision(raw, fractionalDigits(snapStep));
    }
    const next = Math.min(resolvedMax, Math.max(resolvedMin, snapped));
    return commitValue(next, source, parseStatus, formData);
  }

  function commitFromText(source: CommitSource, text: string, formData?: FormData): number | null {
    const result = parseLocaleNumber(text, resolvedLocale, format);
    if (result.status !== 'valid') {
      return commitValue(null, source, result.status, formData);
    }
    let canonical: number;
    if (format?.style === 'percent') {
      canonical = roundToPrecision(
        result.value / 100,
        Math.max(2, fractionalDigits(result.value) + 2),
      );
    } else {
      canonical = result.value;
    }
    return commitFromNumber(source, canonical, formData, 'valid');
  }

  const formattedValue = $derived(
    value === null || value === undefined ? '' : formatNumber(value, resolvedLocale, format),
  );
  const displayValue = $derived(isFocused ? editorBuffer : formattedValue);

  // Parent always wins: when value changes from outside while focused, replace
  // the in-progress editor buffer with a fresh edit-display.
  $effect(() => {
    // Track value, resolvedLocale, format reactively.
    void value;
    void resolvedLocale;
    void format;
    if (!isFocused) return;
    editorBuffer = value === null || value === undefined ? '' : buildEditDisplay(value);
  });

  // Validity sync for required/disabled changes outside commit paths.
  $effect(() => {
    if (!inputElement) return;
    if (disabled) {
      inputElement.setCustomValidity('');
    } else if (required && (value === null || value === undefined)) {
      inputElement.setCustomValidity('Please enter a number.');
    } else if (value !== null && value !== undefined) {
      // Any defined value clears prior malformed/empty errors.
      inputElement.setCustomValidity('');
    }
  });

  function buildEditDisplay(v: number): string {
    const editFormat: Intl.NumberFormatOptions = {
      ...format,
      style: 'decimal',
      useGrouping: false,
      currency: undefined,
      currencyDisplay: undefined,
    };
    if (format?.style === 'percent') {
      const asPercent = roundToPrecision(v * 100, 12);
      return formatNumber(asPercent, resolvedLocale, editFormat);
    }
    return formatNumber(v, resolvedLocale, editFormat);
  }

  function onFocus() {
    editorBuffer = value === null || value === undefined ? '' : buildEditDisplay(value);
    isFocused = true;
  }

  function onBlur() {
    const buffered = editorBuffer;
    isFocused = false;
    commitFromText('blur', buffered);
  }

  function onInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    editorBuffer = target.value;
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

  function stepBy(direction: 'increment' | 'decrement', source: CommitSource, multiplier = 1) {
    const base = getBaseForStep(direction);
    const delta = incrementStep * multiplier * (direction === 'increment' ? 1 : -1);
    commitFromNumber(source, base + delta);
    inputElement?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        stepBy('increment', 'arrow');
        break;
      case 'ArrowDown':
        event.preventDefault();
        stepBy('decrement', 'arrow');
        break;
      case 'PageUp':
        event.preventDefault();
        stepBy('increment', 'page', 10);
        break;
      case 'PageDown':
        event.preventDefault();
        stepBy('decrement', 'page', 10);
        break;
      case 'Home':
        if (Number.isFinite(resolvedMin)) {
          event.preventDefault();
          commitFromNumber('home', resolvedMin);
        }
        break;
      case 'End':
        if (Number.isFinite(resolvedMax)) {
          event.preventDefault();
          commitFromNumber('end', resolvedMax);
        }
        break;
      case 'Enter': {
        event.preventDefault();
        commitFromText('enter', isFocused ? editorBuffer : formattedValue);
        const form = inputElement?.closest('form');
        if (form) {
          if (form.checkValidity()) form.requestSubmit();
          else form.reportValidity();
        }
        break;
      }
    }
  }

  // Form integration: submit (capture), formdata, reset.
  $effect(() => {
    if (!inputElement) return;
    const form = inputElement.closest('form');
    if (!form) return;

    const onSubmit = (event: SubmitEvent) => {
      if (disabled) return;
      if (isFocused) commitFromText('submit', editorBuffer);
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
      }
    };
    const onFormData = (event: FormDataEvent) => {
      if (disabled) return;
      if (isFocused) {
        commitFromText('formdata', editorBuffer, event.formData);
      } else if (typeof name === 'string' && name.length > 0) {
        event.formData.set(name, value === null || value === undefined ? '' : String(value));
      }
    };
    const onReset = () => {
      if (disabled) return;
      commitFromNumber('reset', defaultValue ?? null, undefined, 'valid');
    };

    form.addEventListener('submit', onSubmit, true);
    form.addEventListener('formdata', onFormData);
    form.addEventListener('reset', onReset);

    return () => {
      form.removeEventListener('submit', onSubmit, true);
      form.removeEventListener('formdata', onFormData);
      form.removeEventListener('reset', onReset);
    };
  });

  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-number-input-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-number-input-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(
    error ? ariaInvalid(true) : (context?.invalid ?? rest['aria-invalid'] ?? ariaInvalid(false)),
  );
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const incrementDisabled = $derived(
    resolvedDisabled || (value !== null && value !== undefined && value >= resolvedMax),
  );
  const decrementDisabled = $derived(
    resolvedDisabled || (value !== null && value !== undefined && value <= resolvedMin),
  );

  const showHiddenInput = $derived(
    typeof name === 'string' && name.length > 0 && !resolvedDisabled,
  );
</script>

<div class={cn('cinder-input-field', className)}>
  {#if label}
    <label for={id} class="cinder-input-field__label" data-disabled={resolvedDisabled || undefined}>
      {label}
    </label>
  {/if}

  <div class="cinder-number-input" data-disabled={resolvedDisabled ? '' : undefined}>
    <input
      bind:this={inputElement}
      {id}
      type="text"
      inputmode="decimal"
      value={displayValue}
      disabled={resolvedDisabled}
      required={resolvedRequired}
      aria-invalid={resolvedAriaInvalid}
      aria-describedby={describedBy}
      class="cinder-input cinder-number-input__input"
      oninput={onInput}
      onfocus={onFocus}
      onblur={onBlur}
      onkeydown={onKeyDown}
      {...rest}
    />
    <button
      type="button"
      class="cinder-number-input__stepper cinder-number-input__stepper--increment"
      aria-label="Increment"
      disabled={incrementDisabled}
      onclick={() => stepBy('increment', 'stepper')}
    >
      <span aria-hidden="true">+</span>
    </button>
    <button
      type="button"
      class="cinder-number-input__stepper cinder-number-input__stepper--decrement"
      aria-label="Decrement"
      disabled={decrementDisabled}
      onclick={() => stepBy('decrement', 'stepper')}
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
  {/if}
</div>
