<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Text input that validates and normalizes hex, rgb(), and hsl() color strings, emitting a canonical hex value on blur.
   * @tag form
   * @tag color
   * @useWhen Accepting a precise color value typed or pasted by the user.
   * @useWhen Composing alongside color-picker or color-swatch-picker for combined visual and text-based color entry.
   * @avoidWhen Letting users graze through a color space — use color-picker instead.
   * @avoidWhen Constraining selection to a fixed palette — use color-swatch-picker instead.
   * @related color-picker, color-swatch-picker, input, form-field
   */
  export type { ColorFieldFormat, ColorFieldProps } from './color-field.types.ts';
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { DEV } from 'esm-env';

  import Input from '../input/input.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { parseColor } from '../../utilities/color-luminance.ts';
  import type { ColorFieldFormat, ColorFieldProps } from './color-field.types.ts';

  let {
    id,
    value,
    defaultValue,
    alpha = false,
    formats,
    disabled,
    name,
    placeholder,
    class: className,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onchange,
    required,
    readonly,
    autocomplete,
    autofocus,
    inputmode,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  }: ColorFieldProps = $props();

  type Rgba = { r: number; g: number; b: number; a: number };

  const DEFAULT_FORMATS = ['hex', 'rgb', 'hsl'] as const satisfies readonly ColorFieldFormat[];
  const DEFAULT_PARSE_ERROR = 'Enter a valid hex, rgb(), or hsl() color.';

  const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]([0-9a-f]{2})?([0-9a-f]{2})?)?$/i;
  const RGB_RE = /^rgba?\s*\([^)]*\)\s*$/i;
  const HSL_RE = /^hsla?\s*\([^)]*\)\s*$/i;

  // Mode captured at mount. Runtime mode-switching is unsupported — a DEV warn
  // fires once if observed.
  const isControlled = value !== undefined;
  let warnedModeSwitch = false;
  let warnedEmptyFormats = false;

  if (DEV && value !== undefined && defaultValue !== undefined) {
    console.warn(
      '[cinder/ColorField] Both `value` and `defaultValue` were provided. `value` wins; `defaultValue` is ignored.',
    );
  }

  function effectiveFormats(
    input: readonly ColorFieldFormat[] | undefined,
  ): readonly ColorFieldFormat[] {
    if (!input) return DEFAULT_FORMATS;
    if (input.length === 0) {
      if (DEV && !warnedEmptyFormats) {
        warnedEmptyFormats = true;
        console.warn(
          '[cinder/ColorField] `formats={[]}` is treated as developer error; falling back to default formats.',
        );
      }
      return DEFAULT_FORMATS;
    }
    return input;
  }

  function passesFormatGate(trimmed: string, current: readonly ColorFieldFormat[]): boolean {
    if (current.includes('hex') && HEX_RE.test(trimmed)) return true;
    if (current.includes('rgb') && RGB_RE.test(trimmed)) return true;
    if (current.includes('hsl') && HSL_RE.test(trimmed)) return true;
    return false;
  }

  function toHex2(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  }

  function normalizedHex(rgba: Rgba, withAlpha: boolean): string {
    const base = `#${toHex2(rgba.r)}${toHex2(rgba.g)}${toHex2(rgba.b)}`;
    if (withAlpha && rgba.a < 1) {
      return base + toHex2(rgba.a * 255);
    }
    return base;
  }

  function tryParse(trimmed: string, current: readonly ColorFieldFormat[]): Rgba | null {
    if (!passesFormatGate(trimmed, current)) return null;
    return parseColor(trimmed);
  }

  // ── Internal state ──────────────────────────────────────────────────────

  let visibleText = $state('');
  let committedHex = $state('');
  let committedRgba = $state<Rgba | null>(null);
  let parseError = $state<string | null>(null);

  function applyParsed(rgba: Rgba): void {
    committedRgba = rgba;
    committedHex = normalizedHex(rgba, alpha);
    visibleText = committedHex;
    parseError = null;
  }

  function clearAll(): void {
    visibleText = '';
    committedHex = '';
    committedRgba = null;
    parseError = null;
  }

  function reconcileFromValue(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === '') {
      clearAll();
      return;
    }
    const formatsList = effectiveFormats(formats);
    const rgba = tryParse(trimmed, formatsList);
    if (rgba) {
      applyParsed(rgba);
      return;
    }
    visibleText = raw;
    committedHex = '';
    committedRgba = null;
    parseError = errorMessage ?? DEFAULT_PARSE_ERROR;
  }

  // ── Initialization ──────────────────────────────────────────────────────

  if (isControlled) {
    reconcileFromValue(value ?? '');
  } else if (defaultValue !== undefined && defaultValue !== '') {
    const formatsList = effectiveFormats(formats);
    const rgba = tryParse(defaultValue.trim(), formatsList);
    if (rgba) {
      applyParsed(rgba);
    }
    // Invalid `defaultValue` collapses silently — defaults are author-supplied.
  }

  // ── Controlled-sync $effect (silent — never emits onchange) ─────────────

  let lastReconciledValue: string | undefined = isControlled ? value : undefined;
  $effect(() => {
    if (!isControlled) return;
    const current = value;
    if (current === undefined) {
      if (DEV && !warnedModeSwitch) {
        warnedModeSwitch = true;
        console.warn(
          '[cinder/ColorField] Runtime mode switch detected (controlled -> undefined). Mode is captured at mount; the change is ignored.',
        );
      }
      return;
    }
    // Only reconcile when the controlled value actually changed. Without this
    // guard, Svelte may re-run the effect after our internal commit due to
    // prop-tracking liveness, which would overwrite the optimistic local state
    // with the unchanged parent value.
    if (current === lastReconciledValue) return;
    lastReconciledValue = current;
    reconcileFromValue(current);
  });

  // ── `alpha` prop changes re-derive committedHex silently ────────────────

  let previousAlpha = alpha;
  $effect(() => {
    if (alpha === previousAlpha) return;
    previousAlpha = alpha;
    if (!committedRgba) return;
    committedHex = normalizedHex(committedRgba, alpha);
    visibleText = committedHex;
  });

  // ── Commit pipeline ─────────────────────────────────────────────────────

  type CommitOutcome =
    | 'success-changed'
    | 'success-unchanged'
    | 'cleared'
    | 'noop-empty'
    | 'failure';

  function commit(): CommitOutcome {
    const trimmed = visibleText.trim();
    const formatsList = effectiveFormats(formats);

    if (trimmed === '') {
      if (committedHex !== '') {
        clearAll();
        onchange?.('');
        return 'cleared';
      }
      parseError = null;
      return 'noop-empty';
    }

    // Canonical-display bypass: re-blurring the existing canonical text skips
    // the format gate so a `formats={['rgb']}` field doesn't self-invalidate
    // after a successful commit (visible text becomes hex).
    if (trimmed === committedHex && committedRgba) {
      visibleText = committedHex;
      parseError = null;
      return 'success-unchanged';
    }

    const rgba = tryParse(trimmed, formatsList);
    if (!rgba) {
      parseError = errorMessage ?? DEFAULT_PARSE_ERROR;
      return 'failure';
    }

    const previousHex = committedHex;
    const normalized = normalizedHex(rgba, alpha);

    if (!isControlled) {
      committedRgba = rgba;
      committedHex = normalized;
      visibleText = normalized;
      parseError = null;
      if (normalized !== previousHex) {
        onchange?.(normalized);
        return 'success-changed';
      }
      return 'success-unchanged';
    }

    // Controlled mode
    if (normalized !== previousHex) {
      committedRgba = rgba;
      committedHex = normalized;
      visibleText = normalized;
      parseError = null;
      onchange?.(normalized);
      return 'success-changed';
    }

    // Canonical-display-only branch: visible text update only.
    visibleText = normalized;
    parseError = null;
    return 'success-unchanged';
  }

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    visibleText = target.value;
  }

  function handleBlur(): void {
    const out = commit();
    void out;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const outcome = commit();
    if (anchorInput) {
      anchorInput.value = outcome === 'failure' ? '' : committedHex;
    }
    if (enterBehavior === 'commit-only') return;
    if (outcome === 'failure') return;
    const form = anchorInput?.form;
    if (!form) return;
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    form.requestSubmit(submitter ?? undefined);
  }

  // ── Form reset listener ─────────────────────────────────────────────────

  let anchorInput: HTMLInputElement | null = null;

  function handleReset(): void {
    if (isControlled) return;
    if (defaultValue === undefined || defaultValue === '') {
      clearAll();
      return;
    }
    const formatsList = effectiveFormats(formats);
    const rgba = tryParse(defaultValue.trim(), formatsList);
    if (rgba) {
      applyParsed(rgba);
    } else {
      clearAll();
    }
  }

  const resetAttachment: Attachment<HTMLInputElement> = (input) => {
    anchorInput = input;
    let currentForm: HTMLFormElement | null = null;

    const sync = (): void => {
      const nextForm = input.form;
      if (nextForm === currentForm) return;
      if (currentForm) currentForm.removeEventListener('reset', handleReset);
      currentForm = nextForm;
      if (currentForm) currentForm.addEventListener('reset', handleReset);
    };

    sync();
    queueMicrotask(sync);

    return () => {
      if (currentForm) currentForm.removeEventListener('reset', handleReset);
      currentForm = null;
      anchorInput = null;
    };
  };

  // ── Derived: mirror value and swatch fill ───────────────────────────────

  const mirrorValue = $derived(parseError ? '' : committedHex);
  const swatchStyle = $derived(
    committedHex === '' ? 'background-color: transparent;' : `background-color: ${committedHex};`,
  );
</script>

{#snippet swatch()}
  <span
    class="cinder-color-field__swatch"
    data-empty={committedHex === '' ? '' : undefined}
    data-alpha={alpha ? '' : undefined}
    aria-hidden="true"
    style={swatchStyle}
  ></span>
{/snippet}

<div
  class={classNames('cinder-color-field', className)}
  data-cinder-disabled={disabled ? '' : undefined}
>
  <Input
    {id}
    value={visibleText}
    disabled={disabled ?? false}
    required={required ?? false}
    placeholder={placeholder ?? ''}
    error={parseError ?? ''}
    autocomplete={autocomplete ?? 'off'}
    aria-label={ariaLabel ?? undefined}
    aria-labelledby={ariaLabelledBy ?? undefined}
    autofocus={autofocus ?? false}
    inputmode={inputmode ?? 'text'}
    readonly={readonly ?? false}
    trailing={swatch}
    oninput={handleInput}
    onblur={handleBlur}
    onkeydown={handleKeydown}
  />

  {#if name}
    <input type="hidden" {name} value={mirrorValue} />
  {/if}

  <input type="hidden" aria-hidden="true" {@attach resetAttachment} />
</div>
