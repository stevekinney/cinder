<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Text input that validates and normalizes hex, rgb(), and hsl() color strings into a canonical hex value emitted on blur.
   * @tag form
   * @tag color
   * @useWhen Accepting an exact color value via keyboard entry, including pasted hex, rgb(), or hsl() strings.
   * @useWhen Pairing with color-picker for combined visual selection and text-based entry.
   * @avoidWhen Letting users graze visually across a color space — use color-picker instead.
   * @avoidWhen Constraining selection to a fixed brand palette — use color-swatch-picker instead.
   * @related color-picker, color-swatch-picker, input, form-field
   */
  export type { ColorFieldProps, ColorFieldFormat } from './color-field.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { parseColor } from '../../utilities/color-luminance.ts';
  import Input from '../input/input.svelte';
  import type { ColorFieldProps } from './color-field.types.ts';

  let {
    id,
    class: className,
    value = $bindable(''),
    alpha = false,
    formats = ['hex', 'rgb', 'hsl'],
    disabled = false,
    required = false,
    readonly = false,
    name,
    placeholder,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onchange,
  }: ColorFieldProps = $props();

  type RgbaParts = { r: number; g: number; b: number; a: number };

  let visibleText = $state('');
  let committedHex = $state('');
  let committedRgba = $state<RgbaParts | null>(null);
  let parseError = $state<string | null>(null);
  let anchorInput: HTMLInputElement | null = $state(null);
  // Plain (non-reactive) skip guard for the value-sync effect.
  let lastReconciledValue = '';
  let lastReconciledValueWasInvalid = false;

  function toHex2(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  }

  function normalizeHex(parts: RgbaParts, emitAlpha: boolean): string {
    const base = `#${toHex2(parts.r)}${toHex2(parts.g)}${toHex2(parts.b)}`;
    if (emitAlpha) return base + toHex2(parts.a * 255);
    return base;
  }

  // Emit rule: emit `#rrggbbaa` only when `alpha === true` AND parsed `a < 1`.
  function emitFor(parts: RgbaParts): string {
    return normalizeHex(parts, alpha && parts.a < 1);
  }

  const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]([0-9a-f]{2})?([0-9a-f]{2})?)?$/i;
  const RGB_RE = /^rgba?\s*\([^)]*\)\s*$/i;
  const HSL_RE = /^hsla?\s*\([^)]*\)\s*$/i;
  const DEFAULT_FORMATS = ['hex', 'rgb', 'hsl'] as const;

  const acceptedFormats = $derived(formats.length === 0 ? DEFAULT_FORMATS : formats);

  function passesFormatGate(text: string): boolean {
    if (HEX_RE.test(text)) return acceptedFormats.includes('hex');
    if (RGB_RE.test(text)) return acceptedFormats.includes('rgb');
    if (HSL_RE.test(text)) return acceptedFormats.includes('hsl');
    return false;
  }

  function defaultErrorMessage(): string {
    if (errorMessage !== undefined) return errorMessage;
    const labels: Record<'hex' | 'rgb' | 'hsl', string> = {
      hex: 'hex',
      rgb: 'rgb()',
      hsl: 'hsl()',
    };
    const accepted = acceptedFormats.map((format) => labels[format]);
    if (accepted.length === 1) return `Enter a valid ${accepted[0]} color.`;
    if (accepted.length === 2) return `Enter a valid ${accepted[0]} or ${accepted[1]} color.`;
    return `Enter a valid ${accepted.slice(0, -1).join(', ')}, or ${accepted.at(-1)} color.`;
  }

  function seedFromParts(parts: RgbaParts): void {
    committedRgba = parts;
    committedHex = emitFor(parts);
    visibleText = committedHex;
  }

  function clearAll(): void {
    committedRgba = null;
    committedHex = '';
    visibleText = '';
  }

  // ── Initialization ──────────────────────────────────────────────────────

  // Snapshot the seed props once. Initialization reads only the mount-time
  // value; the value-sync effect below handles later prop changes.
  const initialValue = untrack(() => value);
  const resetTarget = initialValue;

  if (initialValue !== '') {
    const trimmedInitial = initialValue.trim();
    if (trimmedInitial !== '' && passesFormatGate(trimmedInitial)) {
      const parsed = parseColor(trimmedInitial);
      if (parsed !== null) {
        seedFromParts(parsed);
        lastReconciledValue = initialValue;
      } else {
        visibleText = initialValue;
        committedHex = '';
        committedRgba = null;
        parseError = defaultErrorMessage();
        lastReconciledValueWasInvalid = true;
      }
    } else {
      visibleText = initialValue;
      committedHex = '';
      committedRgba = null;
      parseError = defaultErrorMessage();
      lastReconciledValueWasInvalid = true;
    }
  }

  // ── Bindable value sync ─────────────────────────────────────────────────

  function reconcileFromValue(next: string): void {
    const trimmed = next.trim();
    if (trimmed === '') {
      clearAll();
      parseError = null;
      lastReconciledValueWasInvalid = false;
    } else if (!passesFormatGate(trimmed)) {
      visibleText = next;
      committedHex = '';
      committedRgba = null;
      parseError = defaultErrorMessage();
      lastReconciledValueWasInvalid = true;
    } else {
      const parsed = parseColor(trimmed);
      if (parsed === null) {
        visibleText = next;
        committedHex = '';
        committedRgba = null;
        parseError = defaultErrorMessage();
        lastReconciledValueWasInvalid = true;
      } else {
        seedFromParts(parsed);
        parseError = null;
        lastReconciledValueWasInvalid = false;
      }
    }
    // Keep native validity in lockstep with parseError through this single
    // synchronous path — replaces the prior `void parseError` effect that
    // lagged one microtask behind value-sync and alpha-toggle writes.
    syncCustomValidity();
  }

  $effect(() => {
    if (value === lastReconciledValue) return;
    lastReconciledValue = value;
    reconcileFromValue(value);
  });

  // ── alpha runtime changes ───────────────────────────────────────────────

  // Re-derive `committedHex` and `visibleText` from `committedRgba` when the
  // alpha mode toggles after mount. Never emit `onchange` on a config change.
  $effect(() => {
    void alpha;
    if (committedRgba === null) return;
    const nextHex = emitFor(committedRgba);
    if (nextHex === committedHex) return;
    committedHex = nextHex;
    visibleText = nextHex;
    lastReconciledValue = nextHex;
    value = nextHex;
  });

  // ── formats runtime changes — display-only validation ───────────────────

  // A `formats` change only affects the input-time gate. It must never mutate
  // committed state. If there's a current parse error, re-run the gate on the
  // visible text and clear the error when the value now passes. `passesFormatGate`
  // and `defaultErrorMessage` both read `acceptedFormats` through closure, so the
  // effect re-runs on `formats` changes without an explicit dependency pin.
  $effect(() => {
    if (parseError === null) return;
    const text = visibleText.trim();
    if (text === '') {
      parseError = null;
    } else if (!passesFormatGate(text)) {
      // Refresh the message so its wording reflects the new `formats` set,
      // not the wording that was current when the error was first raised.
      parseError = defaultErrorMessage();
    } else {
      const parsed = parseColor(text);
      parseError = parsed === null ? defaultErrorMessage() : null;
    }
    syncCustomValidity();
  });

  // ── Commit pipeline (blur + Enter) ──────────────────────────────────────

  function runCommit(): { committed: boolean; emittedHex: string | null } {
    const trimmed = visibleText.trim();

    if (trimmed === '') {
      const hadCommitted = committedHex !== '';
      const hadInvalidReconciledValue = lastReconciledValueWasInvalid;
      clearAll();
      parseError = null;
      lastReconciledValueWasInvalid = false;
      if (hadCommitted || hadInvalidReconciledValue) {
        lastReconciledValue = '';
        value = '';
        onchange?.('');
        return { committed: true, emittedHex: '' };
      }
      return { committed: false, emittedHex: null };
    }

    // Canonical-display bypass: typing the existing committed hex back in is a no-op.
    if (trimmed === committedHex) {
      visibleText = committedHex;
      parseError = null;
      return { committed: false, emittedHex: null };
    }

    if (!passesFormatGate(trimmed)) {
      parseError = defaultErrorMessage();
      return { committed: false, emittedHex: null };
    }

    const parsed = parseColor(trimmed);
    if (parsed === null) {
      parseError = defaultErrorMessage();
      return { committed: false, emittedHex: null };
    }

    const normalized = emitFor(parsed);
    const previousHex = committedHex;
    parseError = null;
    visibleText = normalized;
    committedRgba = parsed;
    committedHex = normalized;
    lastReconciledValue = normalized;
    value = normalized;
    if (normalized !== previousHex) {
      onchange?.(normalized);
      return { committed: true, emittedHex: normalized };
    }
    return { committed: true, emittedHex: null };
  }

  // Sync the parse-error state into the native input's customValidity so
  // mouse/touch/programmatic submit paths participate in HTML form validation
  // — the Enter handler's manual guard alone is not enough.
  function syncCustomValidity(): void {
    if (anchorInput === null) return;
    // Walk to the wrapper and find the visible input by class. Avoids
    // getElementById, which is unreliable when tests reuse ids across mounts.
    const wrapper = anchorInput.closest('.cinder-color-field');
    if (wrapper === null) return;
    const nativeInput = wrapper.querySelector<HTMLInputElement>('input.cinder-input');
    if (nativeInput === null) return;
    nativeInput.setCustomValidity(parseError ?? '');
  }

  function handleBlur(): void {
    runCommit();
    syncCustomValidity();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runCommit();
    syncCustomValidity();

    if (anchorInput !== null) {
      // Imperatively sync the hidden mirror's DOM value so a synchronous
      // requestSubmit sees the canonical hex (or the empty string after a
      // clear) even before Svelte's reactive binding flushes.
      anchorInput.value = committedHex;
    }

    // Submit when validation succeeded (no parse error), regardless of whether
    // the canonical hex actually changed.
    if (parseError !== null) return;
    if (enterBehavior !== 'commit-then-submit') return;

    const form = anchorInput?.form ?? null;
    if (form === null) return;
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    form.requestSubmit(submitter ?? undefined);
  }

  // ── Form reset wiring ───────────────────────────────────────────────────

  function onFormReset(event: Event): void {
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      resetToInitialValue();
    });
  }

  function resetToInitialValue(): void {
    parseError = null;
    if (resetTarget === '') {
      clearAll();
      lastReconciledValue = '';
      value = '';
      // Sync after all state changes: the catch-all $effect was removed so every
      // exit path must explicitly clear the native custom-validity message.
      syncCustomValidity();
      return;
    }
    const trimmedDefault = resetTarget.trim();
    if (trimmedDefault === '' || !passesFormatGate(trimmedDefault)) {
      clearAll();
      lastReconciledValue = '';
      value = '';
      syncCustomValidity();
      return;
    }
    const parsed = parseColor(trimmedDefault);
    if (parsed === null) {
      clearAll();
      lastReconciledValue = '';
      value = '';
      syncCustomValidity();
      return;
    }
    seedFromParts(parsed);
    lastReconciledValue = committedHex;
    value = committedHex;
    syncCustomValidity();
  }

  $effect(() => {
    const input = anchorInput;
    if (input === null) return;
    const resolvedInput: HTMLInputElement = input;
    let currentForm: HTMLFormElement | null = null;

    function attach(): void {
      const nextForm = resolvedInput.form;
      if (nextForm === currentForm) return;
      currentForm?.removeEventListener('reset', onFormReset);
      currentForm = nextForm;
      currentForm?.addEventListener('reset', onFormReset);
    }

    attach();

    return () => {
      currentForm?.removeEventListener('reset', onFormReset);
    };
  });

  // ── Derived display state ───────────────────────────────────────────────

  const swatchEmpty = $derived(committedHex === '');
  const swatchColor = $derived(committedHex === '' ? 'transparent' : committedHex);
</script>

{#snippet swatch()}
  <span
    class="cinder-color-field__swatch"
    data-cinder-empty={swatchEmpty ? '' : undefined}
    data-cinder-alpha={alpha ? '' : undefined}
    aria-hidden="true"
    style="--cinder-color-field-swatch: {swatchColor};"
  ></span>
{/snippet}

<div
  class={classNames('cinder-color-field', className)}
  data-cinder-disabled={disabled ? '' : undefined}
>
  <Input
    {id}
    bind:value={visibleText}
    {disabled}
    {required}
    {readonly}
    placeholder={placeholder ?? ''}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
    error={parseError ?? ''}
    onblur={handleBlur}
    onkeydown={handleKeydown}
    trailing={swatch}
  />

  <input
    type="hidden"
    {name}
    disabled={disabled || undefined}
    value={committedHex}
    bind:this={anchorInput}
    aria-hidden="true"
  />
</div>
