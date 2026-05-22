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

  function defaultParseError(allowed: readonly ColorFieldFormat[]): string {
    // Build a message that lists only the formats the field currently accepts,
    // so consumers using `formats={['hex']}` don't see "rgb() or hsl()" in
    // their error text. English-only; consumers needing localization should
    // pass `errorMessage`.
    const labels = allowed.map((format) => (format === 'hex' ? 'hex' : `${format}()`));
    const joined =
      labels.length <= 2
        ? labels.join(' or ')
        : `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
    return `Enter a valid ${joined} color.`;
  }

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
    parseError = errorMessage ?? defaultParseError(formatsList);
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
      parseError = errorMessage ?? defaultParseError(formatsList);
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
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    visibleText = target.value;
    // Mirror the parse-error state onto native constraint validity. Without
    // this, a sibling submit button could submit the form with the named
    // hidden mirror set to '' (parseError branch of mirrorValue) while the
    // visible input passes native required validation because its raw text is
    // non-empty. Clearing then re-running constraint state during typing
    // would be hostile; we re-evaluate on commit (handleBlur/handleKeydown).
  }

  function handleBlur(): void {
    // The `$effect` watching `parseError` syncs setCustomValidity reactively;
    // no manual sync call is needed here.
    commit();
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
    const candidate = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button:not([type]):not([disabled]), button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
    // `requestSubmit` throws if the submitter belongs to a different form
    // (a button can opt into another form via `form="<id>"`). Filter to
    // submitters owned by this form; fall back to `undefined` (default submit).
    const submitter = candidate && candidate.form === form ? candidate : undefined;
    form.requestSubmit(submitter ?? undefined);
  }

  // Reactive validity sync: a parse error makes the field "invalid" for
  // native form-submission so a sibling submit button can't bypass our
  // hidden-mirror-clears-on-error safeguard and post stale data. The effect
  // re-runs on every `parseError` and `visibleInput` change — covering user
  // blur, Enter commits, AND controlled-prop updates that hit the invalid
  // branch of reconcileFromValue. The attachment below resolves `visibleInput`
  // once the wrapper div mounts.
  let visibleInput: HTMLInputElement | null = $state(null);
  const visibleInputAttachment: Attachment<HTMLDivElement> = (root) => {
    visibleInput = root.querySelector<HTMLInputElement>('input:not([type="hidden"])');
    return () => {
      visibleInput = null;
    };
  };
  $effect(() => {
    if (!visibleInput) return;
    visibleInput.setCustomValidity(parseError ?? '');
  });

  // ── Form reset listener ─────────────────────────────────────────────────

  let anchorInput: HTMLInputElement | null = null;

  function handleReset(): void {
    if (isControlled) {
      // Controlled mode defers to the parent for state, but the browser's
      // native reset default action (which runs after this handler) will
      // still mutate the visible input's `.value` and the hidden mirror to
      // their DOM-default attribute values. Re-apply the current controlled
      // value in a microtask so the inputs stay aligned with the parent's
      // state through the reset cycle.
      const current = value;
      queueMicrotask(() => {
        if (current === undefined) return;
        // Force `reconcileFromValue` to re-run by clearing the guard. The
        // value identity is unchanged, so the $effect path is blocked by the
        // sentinel; re-applying directly is the deliberate exception.
        lastReconciledValue = undefined;
        reconcileFromValue(current);
      });
      return;
    }
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
  {@attach visibleInputAttachment}
>
  <Input
    {id}
    value={visibleText}
    disabled={disabled ?? false}
    required={required ?? false}
    placeholder={placeholder ?? ''}
    error={parseError ?? ''}
    autocomplete={autocomplete ?? 'off'}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledBy}
    autofocus={autofocus ?? false}
    inputmode={inputmode ?? 'text'}
    readonly={readonly ?? false}
    trailing={swatch}
    oninput={handleInput}
    onblur={handleBlur}
    onkeydown={handleKeydown}
  />

  {#if name}
    <!--
      Disabled controls don't submit per the HTML spec. The visible Input
      already inherits `disabled`, but the named hidden mirror needs it too,
      or a disabled ColorField would still contribute a value to FormData.
    -->
    <input type="hidden" {name} value={mirrorValue} disabled={disabled ?? false} />
  {/if}

  <input type="hidden" aria-hidden="true" {@attach resetAttachment} />
</div>
