<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Text input that validates and normalizes hex, rgb(), hsl(), hwb(), and oklch() color strings into a canonical value (hex by default, or another CSS Color 4 format via `format`) emitted on blur.
   * @tag form
   * @tag color
   * @useWhen Accepting an exact color value via keyboard entry, including pasted hex, rgb(), or hsl() strings.
   * @useWhen Pairing with color-picker for combined visual selection and text-based entry.
   * @avoidWhen Letting users graze visually across a color space — use color-picker instead.
   * @avoidWhen Constraining selection to a fixed brand palette — use color-swatch-picker instead.
   * @related color-picker, color-swatch-picker, input, form-field
   */
  export type {
    ColorFieldProps,
    ColorFieldFormat,
    ColorFieldOutputFormat,
  } from './color-field.types.ts';

  // Module-scope (not per-instance) so it's a single stable reference used
  // as the `formats` prop's default. An inline array-literal default in a
  // `$props()` destructuring (`formats = ['hex', ...]`) is NOT memoized by
  // Svelte — it's re-evaluated (producing a NEW array identity) every time
  // the default is read, including on a re-render triggered by a
  // completely unrelated prop changing. Any `$effect` that reads `formats`
  // (even via `void formats;`) would then see a "changed" reference and
  // re-run on every parent re-render, not just when `formats` itself
  // actually changes — which is exactly what let an `errorMessage`-only
  // change spuriously re-trigger the formats/format reconciliation effect
  // and silently commit an in-progress draft.
  const DEFAULT_FORMATS = ['hex', 'rgb', 'hsl', 'hwb'] as const;
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { formatColor, parseCssColor } from '../../utilities/color-format.ts';
  import Input from '../input/input.svelte';
  import Button from '@lostgradient/cinder/button';
  import ColorPicker from '@lostgradient/cinder/color-picker';
  import Popover from '@lostgradient/cinder/popover';
  import Pipette from 'lucide-svelte/icons/pipette';
  import type {
    ColorFieldFormat,
    ColorFieldOutputFormat,
    ColorFieldProps,
  } from './color-field.types.ts';

  let {
    id,
    class: className,
    value = $bindable(''),
    alpha = false,
    formats = DEFAULT_FORMATS,
    format = 'hex',
    disabled = false,
    required = false,
    readonly = false,
    name,
    placeholder,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    errorMessage,
    enterBehavior = 'commit-then-submit',
    onValueChange,
  }: ColorFieldProps = $props();

  type RgbaParts = { r: number; g: number; b: number; a: number };

  let visibleText = $state('');
  let committedHex = $state('');
  let committedRgba = $state<RgbaParts | null>(null);
  let parseError = $state<string | null>(null);
  let anchorInput: HTMLInputElement | null = $state(null);
  let pickerOpen = $state(false);
  // Plain (non-reactive) skip guard for the value-sync effect.
  let lastReconciledValue = '';
  let lastReconciledValueWasInvalid = false;
  // Plain (non-reactive) skip guards for the formats/format reconciliation
  // effect below. `$effect` re-runs are not guaranteed to fire ONLY when
  // `formats`/`format` themselves change — a Svelte `$props()` update
  // triggered by any OTHER prop (e.g. `errorMessage`) can still re-invoke
  // an effect that merely reads `formats`/`format`, even when their values
  // are unchanged. Comparing against these plain snapshots makes the
  // reconciliation's draft-admission/commit side effect run only on an
  // ACTUAL formats/format change, regardless of why the effect fired.
  let lastReconciledFormats: readonly ColorFieldFormat[] = untrack(() => formats);
  let lastReconciledFormat: ColorFieldOutputFormat = untrack(() => format);

  // Parse any accepted input format — hex, rgb()/rgba(), hsl()/hsla(),
  // hwb(), or oklch() — in either legacy comma syntax or the modern
  // space-separated syntax `formatColor` itself emits. Backed by culori's
  // own CSS color parser (see color-format.ts), not a hand-rolled
  // legacy-comma-only regex parser, so an emitted value always parses back.
  function parseInput(text: string): RgbaParts | null {
    return parseCssColor(text);
  }

  // Emit rule: pass through `alpha` only when `alpha === true` AND parsed
  // `a < 1`; otherwise force fully opaque so config-gated stripping stays
  // uniform across every output format.
  function emitFor(parts: RgbaParts): string {
    const emitAlpha = alpha && parts.a < 1;
    return formatColor({ ...parts, a: emitAlpha ? parts.a : 1 }, format);
  }

  // Content equality, not reference equality — a consumer passing `formats`
  // as an inline array literal (e.g. `formats={['hex']}` directly in a
  // template) gets a NEW array reference on every one of their own
  // re-renders, even when the listed formats haven't changed. Reference
  // equality alone would make the reconciliation guard below think
  // `formats` changed on every such re-render, reopening the exact
  // spurious-reconciliation bug the guard exists to close.
  function formatsEqual(a: readonly ColorFieldFormat[], b: readonly ColorFieldFormat[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  const HEX_RE = /^#[0-9a-f]{3}([0-9a-f]([0-9a-f]{2})?([0-9a-f]{2})?)?$/i;
  const RGB_RE = /^(rgb|rgba)\s*\([^)]*\)\s*$/i;
  const HSL_RE = /^(hsl|hsla)\s*\([^)]*\)\s*$/i;
  const HWB_RE = /^hwb\s*\([^)]*\)\s*$/i;
  const OKLCH_TEXT_RE = /^oklch\s*\([^)]*\)\s*$/i;

  // The EXPLICIT accepted-input set — exactly what the `formats` prop (or
  // its default) lists, with none of the configured output `format` unioned
  // in yet. `passesFormatGate` needs this separately from `acceptedFormats`
  // below: the rgb->rgba / hsl->hsla legacy-alias leniency must only apply
  // when the PLAIN form was explicitly listed, never when it's present only
  // because of the output-format widening (see `passesFormatGate`).
  const explicitFormats = $derived(formats.length === 0 ? DEFAULT_FORMATS : formats);

  // The effective accepted-input set always includes the configured output
  // `format`, unioned in — otherwise a field emitting e.g. oklch() with the
  // default `formats` (which doesn't list 'oklch') could never parse its own
  // emitted value back in, breaking the round-trip. Used for display
  // purposes (the default error message's format list) — `passesFormatGate`
  // does NOT use this directly; see below.
  const acceptedFormats = $derived.by(() => {
    const base = explicitFormats;
    return base.includes(format) ? base : [...base, format];
  });

  function passesFormatGate(text: string): boolean {
    if (HEX_RE.test(text)) return explicitFormats.includes('hex') || format === 'hex';
    const rgbMatch = text.match(RGB_RE);
    if (rgbMatch) {
      const matchedFormat = rgbMatch[1]!.toLowerCase() as 'rgb' | 'rgba';
      if (explicitFormats.includes(matchedFormat)) return true;
      if (matchedFormat === 'rgba' && explicitFormats.includes('rgb')) return true;
      // Implicit widening for the configured output format admits ONLY its
      // own exact syntax — never the legacy `rgba` alias, even when
      // `format` is `'rgb'`. `formats` documents that rgba/hsla aliases can
      // be restricted independently; letting the output-format union widen
      // rgba too would silently override that restriction.
      return format === matchedFormat;
    }
    const hslMatch = text.match(HSL_RE);
    if (hslMatch) {
      const matchedFormat = hslMatch[1]!.toLowerCase() as 'hsl' | 'hsla';
      if (explicitFormats.includes(matchedFormat)) return true;
      if (matchedFormat === 'hsla' && explicitFormats.includes('hsl')) return true;
      return format === matchedFormat;
    }
    if (HWB_RE.test(text)) return explicitFormats.includes('hwb') || format === 'hwb';
    if (OKLCH_TEXT_RE.test(text)) return explicitFormats.includes('oklch') || format === 'oklch';
    return false;
  }

  function defaultErrorMessage(): string {
    if (errorMessage !== undefined) return errorMessage;
    const labels: Record<ColorFieldFormat, string> = {
      hex: 'hex',
      rgb: 'rgb()',
      rgba: 'rgba()',
      hsl: 'hsl()',
      hsla: 'hsla()',
      hwb: 'hwb()',
      oklch: 'oklch()',
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
  // Snapshot the successfully-PARSED reset color too (not just the raw
  // string) — see `resetToInitialValue` below for why: a later
  // `formats`/`format` change can narrow the accepted-input gate enough
  // that `resetTarget` itself is no longer admitted, even though it parsed
  // fine at mount. Re-validating the raw string against the CURRENT gate on
  // every reset would then silently clear the field instead of restoring
  // the color that was actually accepted when the component mounted.
  let resetTargetParsed: RgbaParts | null = null;

  if (initialValue !== '') {
    const trimmedInitial = initialValue.trim();
    if (trimmedInitial !== '' && passesFormatGate(trimmedInitial)) {
      const parsed = parseInput(trimmedInitial);
      if (parsed !== null) {
        seedFromParts(parsed);
        lastReconciledValue = initialValue;
        resetTargetParsed = parsed;
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
      const parsed = parseInput(trimmed);
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

  // ── alpha / format runtime changes ──────────────────────────────────────

  // Re-derive `committedHex` from `committedRgba` when `alpha` toggles OR
  // `format` changes after mount (`emitFor` reads `format` through closure,
  // so this effect implicitly depends on it too — hence the name covers
  // both). Never emits `onValueChange` on a config change.
  //
  // Preserves an in-progress, uncommitted draft: only overwrite the visible
  // `<input>` text when it currently matches the OLD committed mirror
  // (nothing dirty to lose). If the user is mid-edit — `visibleText`
  // already differs from `committedHex` — leave their draft alone; the new
  // `format` naturally applies at their next commit (blur/Enter), since
  // `runCommit` calls `emitFor` with whatever `format` is current at that
  // point. Reformatting the mirror out from under a dirty draft would
  // silently discard keystrokes ColorField otherwise keeps local until
  // commit.
  $effect(() => {
    void alpha;
    void format;
    if (committedRgba === null) return;
    const nextHex = emitFor(committedRgba);
    if (nextHex === committedHex) return;
    const hadNoDraft = visibleText === committedHex;
    committedHex = nextHex;
    lastReconciledValue = nextHex;
    value = nextHex;
    if (hadNoDraft) visibleText = nextHex;
  });

  // ── formats/format runtime changes — reconcile newly-admitted values ────

  // A `formats`/`format` change can widen the effective accepted-input gate
  // (recall `acceptedFormats` always unions in the configured `format` — see
  // above), which can turn a previously-rejected `visibleText` into a valid
  // one. If there's a current parse error, re-run the gate on the visible
  // text.
  //
  // This effect MUST react only to actual `formats`/`format` prop changes —
  // never to `visibleText` edits, and never to `errorMessage` either (see
  // the separate errorMessage-only effect below for why the two must stay
  // split). `void formats; void format;` pins the reactive dependency
  // explicitly; everything else is read inside `untrack(...)` so a
  // keystroke alone can never re-trigger this effect. Without that
  // separation: after an invalid blur/Enter leaves `parseError` set,
  // reading `visibleText` directly (not untracked) would make EVERY
  // subsequent keystroke re-run this effect. As soon as the user's
  // in-progress replacement draft became parseable, `seedFromParts` and the
  // assignment to `value` would commit it before blur or Enter — and without
  // firing `onValueChange` — silently breaking ColorField's local-draft
  // contract (intermediate keystrokes are supposed to stay local until an
  // explicit commit).
  //
  // When the text now passes AND parses, this RECONCILES the committed
  // state (swatch, hidden form mirror, `committedHex`) via `seedFromParts` —
  // it does not merely clear the error. Merely clearing `parseError` would
  // leave the field looking valid while `committedRgba`/`committedHex`
  // stayed at their prior (never-committed) empty state: e.g. a controlled
  // `oklch(...)` value with `formats={['hex']}` and `format="hex"` starts
  // rejected (oklch isn't accepted and isn't the configured format yet); if
  // format later switches to `"oklch"`, `acceptedFormats` now admits that
  // same value, but the value was never seeded on mount because it was
  // rejected then — this effect must seed it now, not just silence the
  // error. `onValueChange` is never fired here, matching the alpha-effect's
  // "never fire onValueChange on a config change" precedent below.
  $effect(() => {
    void formats;
    void format;
    untrack(() => {
      // Guard against this effect firing for a reason OTHER than an actual
      // `formats`/`format` change (see `lastReconciledFormats`/
      // `lastReconciledFormat` above) — only THEN may it run the
      // draft-admission/commit logic below.
      const didFormatsChange =
        !formatsEqual(formats, lastReconciledFormats) || format !== lastReconciledFormat;
      lastReconciledFormats = formats;
      lastReconciledFormat = format;
      if (!didFormatsChange) return;
      if (parseError === null) return;
      const text = visibleText.trim();
      if (text === '') {
        parseError = null;
      } else if (!passesFormatGate(text)) {
        // Refresh the message so its wording reflects the new `formats` set,
        // not the wording that was current when the error was first raised.
        parseError = defaultErrorMessage();
      } else {
        const parsed = parseInput(text);
        if (parsed === null) {
          parseError = defaultErrorMessage();
        } else {
          seedFromParts(parsed);
          parseError = null;
          lastReconciledValue = committedHex;
          value = committedHex;
        }
      }
      syncCustomValidity();
    });
  });

  // ── errorMessage runtime changes — refresh display only, never commit ───

  // A change to `errorMessage` alone (e.g. a localization swap, or clearing
  // a custom message to fall back to the generated one) must refresh the
  // CURRENTLY DISPLAYED error text and native customValidity — but must
  // NEVER re-run format-gate validation or commit an in-progress draft.
  // That commit/reconciliation behavior belongs exclusively to the
  // formats/format effect above. Folding `errorMessage` into that same
  // effect (an earlier iteration of this fix) meant an errorMessage-only
  // change also re-ran the full branch below it: if the user had an invalid
  // blur behind them and had since typed a new, now-valid replacement draft,
  // that draft would get `seedFromParts`-committed to `value` the moment a
  // parent changed `errorMessage` — with no blur, no Enter, and no
  // `onValueChange` — silently breaking the exact local-draft contract the
  // formats/format effect above was written to protect. This effect only
  // ever reassigns `parseError` to a freshly computed message; it never
  // touches `visibleText`, `committedRgba`, `committedHex`, or `value`.
  $effect(() => {
    void errorMessage;
    untrack(() => {
      if (parseError === null) return;
      parseError = defaultErrorMessage();
      syncCustomValidity();
    });
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
        onValueChange?.('');
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

    const parsed = parseInput(trimmed);
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
      onValueChange?.(normalized);
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
    if (resetTarget === '' || resetTargetParsed === null) {
      clearAll();
      lastReconciledValue = '';
      value = '';
      // Sync after all state changes: the catch-all $effect was removed so every
      // exit path must explicitly clear the native custom-validity message.
      syncCustomValidity();
      return;
    }
    // Use the snapshotted PARSED color directly — do not re-validate
    // `resetTarget` against the current `formats`/`format` gate. It was
    // already successfully accepted and parsed once, at mount; a later
    // `format` change can narrow the gate enough to reject its raw syntax
    // even though the color itself is still perfectly valid. `seedFromParts`
    // re-emits it through the CURRENT `format` (and `alpha` stripping
    // policy), so a reset always restores the originally-accepted color,
    // not an empty field.
    seedFromParts(resetTargetParsed);
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

  function handlePickerCommit(next: string, reason: 'pointer' | 'swatch' | 'keyboard'): void {
    const parsed = parseInput(next);
    if (parsed === null) return;
    const normalized = emitFor(parsed);
    const previousHex = committedHex;
    parseError = null;
    visibleText = normalized;
    committedRgba = parsed;
    committedHex = normalized;
    lastReconciledValue = normalized;
    value = normalized;
    if (normalized !== previousHex) onValueChange?.(normalized);
    syncCustomValidity();
    if (reason === 'swatch') pickerOpen = false;
  }
</script>

{#snippet swatch()}
  <Popover bind:open={pickerOpen} label="Choose a color" focusManagement="panel">
    {#snippet trigger()}
      <Button
        type="button"
        class="cinder-color-field__swatch-button"
        aria-label="Choose a color"
        disabled={disabled || readonly}
        onclick={() => (pickerOpen = !pickerOpen)}
      >
        <span
          class="cinder-color-field__swatch"
          data-cinder-empty={swatchEmpty ? '' : undefined}
          data-cinder-alpha={alpha ? '' : undefined}
          aria-hidden="true"
          style="--cinder-color-field-swatch: {swatchColor};"
        ></span>
        <Pipette class="cinder-icon-xs" aria-hidden="true" />
      </Button>
    {/snippet}
    <!--
      Pass the field's own `format` through — `ColorFieldOutputFormat` and
      `ColorPickerFormat` are the same union, so no translation is needed.
      Without this, the embedded picker stayed at its default `'hex'`
      regardless of the field's configured format: any interactive picker
      commit (drag, keyboard) would quantize alpha to an 8-bit hex byte
      internally BEFORE `handlePickerCommit` ever re-parses and reformats it
      into the field's actual `format` — so a translucent `/ 0.5` alpha
      became `/ 0.502` (hex byte round-trip noise) and a near-opaque
      `/ 0.9996` was silently rounded fully opaque, corrupting the committed
      precision even though the field's own text-entry commit path is exact.
    -->
    <ColorPicker
      value={committedHex}
      {alpha}
      {format}
      disabled={disabled || readonly}
      label="Choose a color"
      onValueCommit={handlePickerCommit}
    />
  </Popover>
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
    trailingInteractive
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
