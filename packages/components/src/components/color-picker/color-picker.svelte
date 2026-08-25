<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Interactive saturation, hue, and alpha control for picking an arbitrary color and emitting a normalized value (hex by default, or another CSS Color 4 format via `format`).
   * @tag form
   * @tag color
   * @useWhen Letting users pick any color from the full spectrum with optional alpha.
   * @useWhen Composing a custom color with a fallback palette of preset swatches.
   * @avoidWhen Constraining selection to a fixed brand palette — use color-swatch-picker instead.
   * @related color-swatch-picker, input
   */
  export type { ColorPickerProps, ColorPickerFormat } from './color-picker.types.ts';
</script>

<script lang="ts">
  import type { ColorPickerProps } from './color-picker.types.ts';
  import type {
    ColorSwatch,
    ColorSwatchPickerProps,
  } from '../color-swatch-picker/color-swatch-picker.types.ts';
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    canonicalAlpha,
    formatColor,
    formatHex,
    isCanonicallyOpaque,
  } from '../../utilities/color-format.ts';
  import ColorSwatchPicker from '../color-swatch-picker/color-swatch-picker.svelte';
  import ColorPickerControls from './color-picker-controls.svelte';
  import {
    alphaFromKeyboard,
    clamp,
    gradientFromKeyboard,
    hslToRgb,
    hueFromKeyboard,
    parseToHsla,
    type Hsla,
  } from './color-picker.utilities.ts';

  const pickerId = $props.id();

  let {
    value = $bindable(''),
    alpha = false,
    format = 'hex',
    name,
    swatches,
    disabled = false,
    class: className,
    label = 'Color picker',
    onValueCommit,
    onValueChange,
  }: ColorPickerProps = $props();

  // Convert internal HSLA state to the emitted string in the configured
  // `format`. `alpha` (UI-affordance only) already gates whether `a` can be
  // <1 upstream in `applyHsla` — this function does not re-gate it, so the
  // format's own alpha-emission policy (emit iff a < 1) is the sole authority
  // once a value reaches here, per the CIN-104 ruling.
  function emitValue(h: number, s: number, l: number, a: number): string {
    const { r, g, b } = hslToRgb(h, s, l);
    return formatColor({ r, g, b, a }, format);
  }

  // Always genuinely hex, regardless of `format` — used for swatch-matching
  // plumbing (see `normalizeSwatch` below) and the "Copy HEX format" action,
  // neither of which should follow the configured output `format`.
  function hexFor(h: number, s: number, l: number, a: number): string {
    const { r, g, b } = hslToRgb(h, s, l);
    return formatHex({ r, g, b, a });
  }

  const gradientId = `${pickerId}-gradient`;
  const hueId = `${pickerId}-hue`;
  const alphaId = `${pickerId}-alpha`;
  const previewId = `${pickerId}-preview`;

  // Internal canonical state is HSLA. We only round-trip to RGB/hex at the edges.
  let hue = $state(0); // 0–360
  let saturation = $state(100); // 0–100 (HSL saturation at the gradient corner)
  let lightnessValue = $state(50); // 0–100
  let alphaValue = $state(1); // 0–1

  let internalValue = $state('');
  // Plain (non-reactive) coordination var: holds the most recent value the component
  // wrote out to `value`. The controlled-sync effect uses this to skip its own echo.
  let lastEmittedHex = '';
  let isDragging = $state(false);
  // Whether the HSLA state above represents a real color, decoupled from
  // whatever `internalValue` string it emits to — this is what lets the
  // controlled-sync effect (below) update HSLA state WITHOUT reading
  // `format` at all (it never calls `emitValue`), so it cannot race with the
  // dedicated internalValue-sync effect on a bare `format` switch. See the
  // PR #1420 review thread on controlled-sync vs. format-switch racing.
  let hasValue = $state(false);

  function gatedAlpha(a: number): number {
    return alpha ? a : 1;
  }

  // Sets internal HSLA state verbatim — used for *programmatic* value
  // arrival (mount-time seed, the controlled `value`-prop sync effect, and
  // native form reset). Per the CIN-104 ruling, `alpha` (the alpha-slider
  // UI affordance) does not override a programmatically-passed value's own
  // alpha — a translucent `value` stays translucent even while the alpha
  // slider is hidden.
  function applyHsla(next: Hsla): void {
    hue = next.h;
    saturation = next.s;
    lightnessValue = next.l;
    alphaValue = next.a;
    hasValue = true;
  }

  // Resets HSLA state to the "no color" sentinel. Deliberately does NOT
  // touch `internalValue`/`lastEmittedHex`/`value` itself — every call site
  // owns those explicitly (mount-time init writes only `internalValue`; the
  // controlled-sync and reset effects let the dedicated internalValue-sync
  // effect below react to `hasValue` flipping to `false`).
  function clearHsla(): void {
    hue = 0;
    saturation = 0;
    lightnessValue = 0;
    alphaValue = 1;
    hasValue = false;
  }

  // Sets internal HSLA state for a *user-driven* commit (pointer drag,
  // keyboard, swatch selection) and re-gates alpha to fully opaque when the
  // alpha affordance is currently disabled. This is what "heals" a
  // previously-stored translucent value back to opaque: the alpha slider
  // itself can only ever produce a<1 while `alpha` is true, so any other
  // interactive gesture (hue, gradient, swatch) re-clamps a stale translucent
  // alphaValue on its next commit rather than silently carrying it forward
  // forever once the control is disabled.
  function applyHslaInteractive(next: Hsla): void {
    applyHsla({ ...next, a: gatedAlpha(next.a) });
  }

  // Snapshot the seed props once. Initialization reads only the mount-time
  // values; the controlled-sync effect (below) handles later `value` changes.
  const initialValue = untrack(() => value);
  const resetTarget = initialValue;

  // Initialize from the mount-time bindable value. Deliberately does NOT
  // write the normalized string back into the bindable `value` itself — only
  // `internalValue` (which drives the hidden form-mirror input and every
  // rendered/derived display string) is normalized at mount. A consumer's
  // own `bind:value` variable is left exactly as they passed it in (e.g. a
  // legacy comma-syntax or non-canonical-`format` string) until the first
  // user-driven commit, at which point `emit()` writes the fully normalized
  // string back. This is a deliberate "no unsolicited mount-time writes"
  // choice, matching the CIN-378 ticket's "default makes migration a no-op"
  // principle — mounting the component must never itself mutate a prop the
  // consumer owns.
  if (initialValue !== '') {
    const parsed = parseToHsla(initialValue);
    if (parsed) {
      applyHsla(parsed);
      // `applyHsla` sets `alphaValue` to `parsed.a` verbatim (programmatic
      // seed, ungated) — read `parsed.a` directly rather than the `$state`
      // var here since this runs outside any reactive context.
      internalValue = emitValue(parsed.h, parsed.s, parsed.l, parsed.a);
    } else {
      clearHsla();
      internalValue = '';
      lastEmittedHex = '';
    }
  }

  // Sync incoming `value` (controlled) to internal HSLA state ONLY — it
  // deliberately never calls `emitValue` (which reads `format`), so this
  // effect's reactive dependencies are `value`/`lastEmittedHex` alone, never
  // `format`. Recomputing `internalValue` and writing back to `value` is
  // owned entirely by the dedicated internalValue-sync effect below, which
  // reacts to `hasValue`/hue/saturation/lightnessValue/alphaValue/`format`
  // explicitly. Splitting these apart is what prevents a bare `format`
  // switch from racing this effect: previously, this effect *also* computed
  // `internalValue` (implicitly depending on `format` through `emitValue`),
  // so on a format change both effects fired, this one ran first and set
  // `internalValue` to the new syntax, and the dedicated effect then saw
  // `next === internalValue` and bailed out WITHOUT writing the new syntax
  // to `value` — the hidden form input updated but a consumer's
  // `bind:value` silently stayed on the old syntax. We compare against
  // `lastEmittedHex` rather than using a one-shot suppression flag so a
  // parent that normalizes or rejects the emitted value (and writes a
  // different one back) is not ignored.
  $effect(() => {
    if (value === undefined) return;
    if (value !== '' && value === lastEmittedHex) return;
    const parsed = value === '' ? null : parseToHsla(value);
    if (parsed === null) {
      clearHsla();
      return;
    }
    applyHsla(parsed);
  });

  // Single source of truth for `internalValue` / the bound `value` / the
  // hidden form-mirror: reacts to `hasValue`, hue, saturation,
  // lightnessValue, alphaValue, AND `format`. Runs whenever ANY of those
  // change, regardless of whether the HSLA change came from the controlled-
  // sync effect above, an interactive commit, or a bare `format` switch —
  // there is exactly one writer of `internalValue`/`value` now, so there is
  // nothing left to race. This does NOT react to `alpha`: toggling the
  // alpha-slider affordance alone must not retroactively mutate a stored
  // value (see the CIN-104 ruling note on `applyHsla` above) — a stale
  // *interactive* translucent alpha only re-gates to opaque on the next
  // user-driven commit, via `applyHslaInteractive` below.
  $effect(() => {
    void format;
    if (!hasValue) {
      if (internalValue === '') return;
      internalValue = '';
      lastEmittedHex = '';
      if (value !== undefined && value !== '') value = '';
      return;
    }
    const next = emitValue(hue, saturation, lightnessValue, alphaValue);
    if (next === internalValue) return;
    internalValue = next;
    lastEmittedHex = next;
    if (value !== undefined && value !== next) value = next;
  });

  function emit(reason: 'input' | 'change'): void {
    const next = emitValue(hue, saturation, lightnessValue, alphaValue);
    internalValue = next;
    lastEmittedHex = next;
    if (value !== undefined) value = next;
    // Every value mutation fires `onValueChange`; `onValueCommit` additionally fires on commit.
    onValueChange?.(next);
    if (reason === 'change') onValueCommit?.(next, 'keyboard');
  }

  function commitFromHsla(next: Hsla, reason: 'input' | 'change'): void {
    applyHslaInteractive(next);
    emit(reason);
  }

  function commitCurrentValueChange(reason: 'pointer' | 'swatch' = 'pointer'): void {
    const next = emitValue(hue, saturation, lightnessValue, alphaValue);
    internalValue = next;
    lastEmittedHex = next;
    if (value !== undefined) value = next;
    onValueCommit?.(next, reason);
  }

  // ── Gradient handling ──────────────────────────────────────────────────

  let gradientElement: HTMLDivElement | null = $state(null);

  /**
   * Map a pointer event to (saturation, lightness) using the HSV-style square
   * common to color pickers: x = saturation 0→100, y = value 100→0. We convert
   * HSV to HSL on the way out so internal state stays HSL.
   */
  function pointerToHsl(event: PointerEvent): { s: number; l: number } {
    const target = gradientElement;
    if (!target) return { s: saturation, l: lightnessValue };
    const rect = target.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const sv = rect.width === 0 ? 0 : x / rect.width; // 0–1 HSV saturation
    const vv = rect.height === 0 ? 1 : 1 - y / rect.height; // 0–1 HSV value
    // HSV → HSL
    const l = vv * (1 - sv / 2);
    const s = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l);
    return { s: s * 100, l: l * 100 };
  }

  function handleGradientPointerDown(event: PointerEvent): void {
    if (disabled) return;
    event.preventDefault();
    gradientElement?.setPointerCapture(event.pointerId);
    isDragging = true;
    const { s, l } = pointerToHsl(event);
    commitFromHsla({ h: hue, s, l, a: alphaValue }, 'input');
  }

  function handleGradientPointerMove(event: PointerEvent): void {
    if (!isDragging || disabled) return;
    const { s, l } = pointerToHsl(event);
    commitFromHsla({ h: hue, s, l, a: alphaValue }, 'input');
  }

  function handleGradientPointerUp(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    gradientElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleGradientPointerCancel(event: PointerEvent): void {
    if (!isDragging) return;
    isDragging = false;
    gradientElement?.releasePointerCapture(event.pointerId);
  }

  // ── Slider pointer handling ─────────────────────────────────────────────

  // bind:this refs use $state so teardown sees the latest element references;
  // the drag discriminator is read only inside event handlers.
  let hueElement = $state<HTMLDivElement | null>(null);
  let alphaElement = $state<HTMLDivElement | null>(null);
  let draggingSlider: 'hue' | 'alpha' | null = null;

  function pointerToFraction(event: PointerEvent, element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    return rect.width === 0 ? 0 : x / rect.width;
  }

  function handleHuePointerDown(event: PointerEvent): void {
    if (disabled || !hueElement) return;
    event.preventDefault();
    hueElement.setPointerCapture(event.pointerId);
    draggingSlider = 'hue';
    const fraction = pointerToFraction(event, hueElement);
    commitFromHsla({ h: fraction * 359, s: saturation, l: lightnessValue, a: alphaValue }, 'input');
  }

  function handleHuePointerMove(event: PointerEvent): void {
    if (draggingSlider !== 'hue' || disabled || !hueElement) return;
    const fraction = pointerToFraction(event, hueElement);
    commitFromHsla({ h: fraction * 359, s: saturation, l: lightnessValue, a: alphaValue }, 'input');
  }

  function handleHuePointerUp(event: PointerEvent): void {
    if (draggingSlider !== 'hue') return;
    draggingSlider = null;
    hueElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleHuePointerCancel(event: PointerEvent): void {
    if (draggingSlider !== 'hue') return;
    draggingSlider = null;
    hueElement?.releasePointerCapture(event.pointerId);
  }

  function handleAlphaPointerDown(event: PointerEvent): void {
    if (disabled || !alphaElement) return;
    event.preventDefault();
    alphaElement.setPointerCapture(event.pointerId);
    draggingSlider = 'alpha';
    const fraction = pointerToFraction(event, alphaElement);
    commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: fraction }, 'input');
  }

  function handleAlphaPointerMove(event: PointerEvent): void {
    if (draggingSlider !== 'alpha' || disabled || !alphaElement) return;
    const fraction = pointerToFraction(event, alphaElement);
    commitFromHsla({ h: hue, s: saturation, l: lightnessValue, a: fraction }, 'input');
  }

  function handleAlphaPointerUp(event: PointerEvent): void {
    if (draggingSlider !== 'alpha') return;
    draggingSlider = null;
    alphaElement?.releasePointerCapture(event.pointerId);
    commitCurrentValueChange();
  }

  function handleAlphaPointerCancel(event: PointerEvent): void {
    if (draggingSlider !== 'alpha') return;
    draggingSlider = null;
    alphaElement?.releasePointerCapture(event.pointerId);
  }

  // ── Slider keyboard handling ────────────────────────────────────────────

  function currentHsla(): Hsla {
    return { h: hue, s: saturation, l: lightnessValue, a: alphaValue };
  }

  function handleHueKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = hueFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  function handleAlphaKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = alphaFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  // Gradient region keyboard arrow keys also nudge saturation/lightness so the
  // region is at least partially keyboard-operable, even though the underlying
  // 2D selection is inherently pointer-friendly. Documented in a11y memo.
  function handleGradientKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    const next = gradientFromKeyboard(currentHsla(), event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    commitFromHsla(next, 'change');
  }

  // ── Swatch composition ──────────────────────────────────────────────────

  /**
   * Canonicalize a swatch string to hex — always hex, regardless of the
   * configured `format` — so value-matching in ColorSwatchPicker works
   * regardless of input syntax (#0f0 vs #00ff00 vs rgb()), and so
   * ColorSwatchPicker's own contrast/alpha helpers (which only understand
   * legacy comma-syntax hex/rgb/hsl/hwb, not oklch or modern syntax) always
   * receive something they can parse. Swatch plumbing intentionally stays
   * in this parseable canonical form; only the publicly emitted `value` /
   * `onValueChange` / `onValueCommit` payloads follow `format`. Returns
   * `null` for an unparseable swatch.
   *
   * Uses the swatch's alpha VERBATIM (not `gatedAlpha`) so this matches
   * `currentHexForSwatches` below, which is also computed from the raw,
   * possibly-retained `alphaValue` — not gated by the `alpha` affordance.
   * Without this, a programmatically-retained translucent `value` (e.g.
   * `alpha={false}` + `value="#ff000080"`, per the CIN-104 alpha-retention
   * ruling) would never match an identically-translucent `swatches` entry:
   * this function would gate it to `#ff0000` while `currentHexForSwatches`
   * stayed at `#ff000080`, so `ColorSwatchPicker`'s exact-string equality
   * check would never mark the matching option `aria-selected`. Gating by
   * `alpha` still happens — correctly — at the moment a swatch is actually
   * *committed* interactively (`handleSwatchChange` below), not here.
   */
  function normalizeSwatch(swatch: string): string | null {
    const parsed = parseToHsla(swatch);
    if (!parsed) return null;
    return hexFor(parsed.h, parsed.s, parsed.l, parsed.a).toLowerCase();
  }

  /**
   * Pre-normalized swatches mapped to the ColorSwatch shape that ColorSwatchPicker
   * expects. Entries that fail `normalizeSwatch` keep their original string as the
   * color: a CSS-valid-but-non-normalizable value still paints its swatch background,
   * while a truly invalid value (e.g. `not-a-color`) paints nothing — either way it
   * never matches the selected value, so it can never show as selected or be committed.
   */
  const normalizedSwatchColors = $derived<ColorSwatch[]>(
    (swatches ?? []).map((swatch) => {
      const normalized = normalizeSwatch(swatch);
      return {
        color: normalized ?? swatch,
        disabled: normalized === null,
      };
    }),
  );

  // Always hex, for value-matching against the (always-hex) swatch colors —
  // see `normalizeSwatch` above for why swatch plumbing stays hex-only.
  const currentHexForSwatches = $derived(hexFor(hue, saturation, lightnessValue, alphaValue));

  // The "Copy HEX format" action must genuinely be hex regardless of
  // `format` (see hexFor above).
  const hexValue = $derived(
    internalValue === '' ? '' : hexFor(hue, saturation, lightnessValue, alphaValue),
  );

  // These copy/preview strings key off the *actual* alphaValue, not the
  // `alpha` UI-affordance prop: a retained translucent value (see the
  // CIN-104 alpha-retention ruling on `applyHsla` above) must render and
  // copy consistently translucent even while the alpha slider is hidden.
  //
  // Both the opacity GATE and the rounding PRECISION here must match
  // `formatColor`'s exactly (`isCanonicallyOpaque`/`canonicalAlpha`, both at
  // 4 decimals) — not a raw `alphaValue < 1` check or a differently-rounded
  // display value. An alpha like 0.9996 canonicalizes to itself (still
  // translucent) under `formatColor`'s 4-decimal precision, so the
  // configured non-hex `format` correctly emits `/ 0.9996`; the old
  // 3-decimal `roundFormatAlpha` (`Math.round(value * 1000) / 1000`) rounded
  // that SAME 0.9996 up to exactly `1`, so these copy strings displayed
  // `rgba(r, g, b, 1)` — an opaque-looking payload for a value the emitted
  // `value` still correctly reported as translucent.
  const formatRgb = $derived.by(() => {
    const { r, g, b } = hslToRgb(hue, saturation, lightnessValue);
    const channels = `${r}, ${g}, ${b}`;
    return isCanonicallyOpaque(alphaValue)
      ? `rgb(${channels})`
      : `rgba(${channels}, ${canonicalAlpha(alphaValue)})`;
  });
  function roundFormatChannel(value: number): number {
    return Math.round(value * 100) / 100;
  }
  const formatHsl = $derived(
    isCanonicallyOpaque(alphaValue)
      ? `hsl(${roundFormatChannel(hue)}, ${roundFormatChannel(saturation)}%, ${roundFormatChannel(lightnessValue)}%)`
      : `hsla(${roundFormatChannel(hue)}, ${roundFormatChannel(saturation)}%, ${roundFormatChannel(lightnessValue)}%, ${canonicalAlpha(alphaValue)})`,
  );
  function handleSwatchChange(
    selectedColor: Parameters<NonNullable<ColorSwatchPickerProps['onValueChange']>>[0],
  ): void {
    if (disabled) return;
    const parsed = parseToHsla(selectedColor);
    if (!parsed) return;
    commitFromHsla(parsed, 'input');
    const hex = emitValue(parsed.h, parsed.s, parsed.l, gatedAlpha(parsed.a));
    onValueCommit?.(hex, 'swatch');
  }

  // ── Form reset ──────────────────────────────────────────────────────────

  let hiddenInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    const input = hiddenInput;
    if (input === null) return;
    // Use input.form (not closest('form')): HTMLInputElement.form honors the `form`
    // attribute association, so a hidden input linked to a non-ancestor form via
    // <input form="id"> still wires up its reset listener.
    const form = input.form;
    if (form === null) return;

    function resetToDefault(): void {
      const parsed = resetTarget === '' ? null : parseToHsla(resetTarget);
      if (parsed === null) {
        clearHsla();
        internalValue = '';
        lastEmittedHex = '';
        if (value !== undefined) value = '';
        return;
      }
      applyHsla(parsed);
      const hex = emitValue(parsed.h, parsed.s, parsed.l, alphaValue);
      internalValue = hex;
      lastEmittedHex = hex;
      if (value !== undefined) value = hex;
    }

    form.addEventListener('reset', resetToDefault);
    return () => {
      form.removeEventListener('reset', resetToDefault);
    };
  });

  // ── Visual derived data ─────────────────────────────────────────────────

  const hueColor = $derived(`hsl(${hue}, 100%, 50%)`);
  // Keys off `isCanonicallyOpaque(alphaValue)`, not the `alpha` prop and not
  // a raw `alphaValue < 1` check — see the note on `formatRgb`/`formatHsl`
  // above. Must agree with the emitted `value`/copy strings on the SAME
  // 0.9995–1 canonicalization boundary, or the preview (and the checkerboard
  // gate in color-picker-controls.svelte, which reads this same alphaValue)
  // would show translucent for a value everything else reports as opaque.
  const previewColor = $derived(
    internalValue === ''
      ? 'transparent'
      : isCanonicallyOpaque(alphaValue)
        ? `hsl(${hue}, ${saturation}%, ${lightnessValue}%)`
        : `hsla(${hue}, ${saturation}%, ${lightnessValue}%, ${canonicalAlpha(alphaValue)})`,
  );

  // HSV position of the gradient handle (x = HSV saturation, y = HSV value).
  const handlePosition = $derived.by(() => {
    const ln = lightnessValue / 100;
    const sn = saturation / 100;
    const v = ln + sn * Math.min(ln, 1 - ln);
    const svFromHsl = v === 0 ? 0 : 2 * (1 - ln / v);
    return { x: svFromHsl * 100, y: (1 - v) * 100 };
  });

  const hueAriaValue = $derived(Math.round(hue));
  const alphaAriaValue = $derived(Math.round(alphaValue * 100));
</script>

<div
  class={classNames('cinder-color-picker', className)}
  data-cinder-disabled={disabled ? '' : undefined}
  data-cinder-alpha={alpha ? '' : undefined}
  aria-label={label}
  role="group"
  id={pickerId}
>
  <ColorPickerControls
    {gradientId}
    {hueId}
    {alphaId}
    {previewId}
    {disabled}
    {alpha}
    {hue}
    {saturation}
    {lightnessValue}
    {alphaValue}
    {hueColor}
    {previewColor}
    {internalValue}
    {hexValue}
    {formatRgb}
    {formatHsl}
    {handlePosition}
    {hueAriaValue}
    {alphaAriaValue}
    bind:gradientElement
    bind:hueElement
    bind:alphaElement
    onGradientPointerDown={handleGradientPointerDown}
    onGradientPointerMove={handleGradientPointerMove}
    onGradientPointerUp={handleGradientPointerUp}
    onGradientPointerCancel={handleGradientPointerCancel}
    onGradientKeydown={handleGradientKeydown}
    onHueKeydown={handleHueKeydown}
    onHuePointerDown={handleHuePointerDown}
    onHuePointerMove={handleHuePointerMove}
    onHuePointerUp={handleHuePointerUp}
    onHuePointerCancel={handleHuePointerCancel}
    onAlphaKeydown={handleAlphaKeydown}
    onAlphaPointerDown={handleAlphaPointerDown}
    onAlphaPointerMove={handleAlphaPointerMove}
    onAlphaPointerUp={handleAlphaPointerUp}
    onAlphaPointerCancel={handleAlphaPointerCancel}
  />

  {#if normalizedSwatchColors.length > 0}
    <ColorSwatchPicker
      colors={normalizedSwatchColors}
      value={internalValue !== '' ? currentHexForSwatches.toLowerCase() : ''}
      label="Color swatches"
      size="sm"
      {disabled}
      class="cinder-color-picker__swatches"
      onValueChange={handleSwatchChange}
    />
  {/if}

  {#if name}
    <input bind:this={hiddenInput} type="hidden" {name} value={internalValue} />
  {:else}
    <input bind:this={hiddenInput} type="hidden" value={internalValue} hidden />
  {/if}
</div>
